import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { safeAsync, dbErr } from "../../shared/errors";
import { warn } from "../../shared/logger";
import {
  unitInstanceToBoardUnit,
  boardUnitToUnitInstance,
  pvpOpponentToEnemyTeam,
} from "../../shared/board-unit";
import type { PvpOpponent, MatchedOpponent } from "../../shared/board-unit";
import type { EnemyTeam } from "../../shared/types";
import { simulateBattle } from "../../engine/battle";
import { generateEnemyTeam } from "../../engine/helpers";
import { createSeededRng } from "../../engine/rng";
import { boardSnapshots, battles, runs } from "../../db/schema";
import { generateId } from "../auth/crypto";
import { requireAuth } from "../auth/middleware";
import type { AuthEnv } from "../auth/types";
import { findOpponent } from "./matchmaking";
import { jsonBody, getParsedBody, bodyField } from "../parse-json";
import { internalError } from "../error-response";
import { validateSnapshotBody, validateNight, validateNonEmptyString } from "./pvp-validation";
import { markSeenAsync } from "../lore/lore-service";

const pvp = new Hono<AuthEnv>();

pvp.post("/snapshot", requireAuth, jsonBody(10_000), async (c) => {
  const db = c.get("db");
  const playerId = c.get("playerId");

  const body = getParsedBody(c);
  if (!validateSnapshotBody(body)) {
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "invalid_snapshot" } }, 400);
  }

  const runCheck = await safeAsync(
    () =>
      db
        .select({ id: runs.id, life: runs.life, trophy: runs.trophy })
        .from(runs)
        .where(and(eq(runs.id, body.runId), eq(runs.playerId, playerId), eq(runs.status, "active")))
        .limit(1),
    dbErr,
  );
  if (runCheck.isErr()) return internalError(c, "[pvp/snapshot:run]", runCheck.error);
  const run = runCheck.value[0];
  if (!run) {
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "invalid_run" } }, 400);
  }

  const now = new Date();
  const upsertResult = await safeAsync(
    () =>
      db
        .insert(boardSnapshots)
        .values({
          id: generateId(),
          playerId,
          runId: body.runId,
          night: body.night,
          board: body.board,
          life: run.life,
          trophy: run.trophy,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [boardSnapshots.runId, boardSnapshots.night],
          set: {
            board: body.board,
            life: run.life,
            trophy: run.trophy,
            createdAt: now,
          },
        }),
    dbErr,
  );
  if (upsertResult.isErr()) return internalError(c, "[pvp/snapshot]", upsertResult.error);

  return c.json({ ok: true });
});

function generateBattleSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  // seed=0 は xorshift RNG を壊す（後続値がすべて0になる）
  return (buf[0] ?? 0) >>> 0 || 1;
}

function resolveEnemy(matched: MatchedOpponent | null, night: number): EnemyTeam {
  if (matched) return pvpOpponentToEnemyTeam(matched);
  return generateEnemyTeam(night, createSeededRng(generateBattleSeed()));
}

type SaveVerifyError = { kind: "infra"; label: string; cause: unknown } | { kind: "race" };

async function saveBattleAndVerify(
  db: DrizzleD1Database,
  battleId: string,
  values: typeof battles.$inferInsert,
  runId: string,
  night: number,
): Promise<SaveVerifyError | null> {
  const saveResult = await safeAsync(
    () =>
      db
        .insert(battles)
        .values(values)
        .onConflictDoNothing({ target: [battles.runId, battles.night] }),
    dbErr,
  );
  if (saveResult.isErr())
    return { kind: "infra", label: "[pvp/battle:save]", cause: saveResult.error };

  const verify = await safeAsync(
    () =>
      db
        .select({ id: battles.id })
        .from(battles)
        .where(and(eq(battles.runId, runId), eq(battles.night, night)))
        .limit(1),
    dbErr,
  );
  if (verify.isErr()) return { kind: "infra", label: "[pvp/battle:verify]", cause: verify.error };
  if (verify.value[0]?.id !== battleId) {
    warn("[pvp/battle] race: battle_already_exists", {
      runId,
      night,
      battleId,
      actualId: verify.value[0]?.id,
    });
    return { kind: "race" };
  }
  return null;
}

type LoadBoardResult =
  | { error: unknown; label: string }
  | { precondition: string }
  | { board: ReturnType<typeof boardUnitToUnitInstance>[] };

async function loadPlayerBoard(
  db: DrizzleD1Database,
  runId: string,
  night: number,
  playerId: string,
): Promise<LoadBoardResult> {
  const runCheck = await safeAsync(
    () =>
      db
        .select({ id: runs.id })
        .from(runs)
        .where(and(eq(runs.id, runId), eq(runs.playerId, playerId), eq(runs.status, "active")))
        .limit(1),
    dbErr,
  );
  if (runCheck.isErr()) return { error: runCheck.error, label: "[pvp/battle:run]" };
  if (!runCheck.value[0]) return { precondition: "invalid_run" };

  const snapshotResult = await safeAsync(
    () =>
      db
        .select({ board: boardSnapshots.board })
        .from(boardSnapshots)
        .where(and(eq(boardSnapshots.runId, runId), eq(boardSnapshots.night, night)))
        .limit(1),
    dbErr,
  );
  if (snapshotResult.isErr())
    return { error: snapshotResult.error, label: "[pvp/battle:snapshot]" };
  if (!snapshotResult.value[0]) return { precondition: "no_snapshot" };

  return { board: snapshotResult.value[0].board.map(boardUnitToUnitInstance) };
}

function extractBoard(
  c: { json: (d: unknown, s: number) => Response },
  loaded: LoadBoardResult,
): Response | { board: ReturnType<typeof boardUnitToUnitInstance>[] } {
  if ("error" in loaded) return internalError(c, loaded.label, loaded.error);
  if ("precondition" in loaded)
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: loaded.precondition } }, 400);
  return loaded;
}

function buildBattleRecord(
  playerId: string,
  runId: string,
  night: number,
  matchedOpponent: MatchedOpponent | null,
  playerBoard: ReturnType<typeof boardUnitToUnitInstance>[],
) {
  const enemy = resolveEnemy(matchedOpponent, night);
  const battleSeed = generateBattleSeed();
  const { frames, result } = simulateBattle(playerBoard, enemy, night, battleSeed);
  const mappedUnits = enemy.units.map(unitInstanceToBoardUnit);
  const opponent: PvpOpponent = matchedOpponent
    ? { ...matchedOpponent, units: mappedUnits }
    : {
        playerId: null,
        teamName: enemy.teamName,
        teamType: enemy.teamType,
        units: mappedUnits,
        night: null,
        life: null,
        trophy: null,
      };
  const battleId = generateId();
  const values: typeof battles.$inferInsert = {
    id: battleId,
    playerId,
    runId,
    opponentPlayerId: matchedOpponent?.playerId ?? null,
    night,
    seed: battleSeed,
    opponent,
    result: result ?? "DRAW",
    createdAt: new Date(),
  };
  return { battleId, frames, result, opponent, battleSeed, values };
}

pvp.post("/battle", requireAuth, jsonBody(), async (c) => {
  const db = c.get("db");
  const playerId = c.get("playerId");
  const parsedBody = getParsedBody(c);
  const night = bodyField(parsedBody, "night");
  const runId = bodyField(parsedBody, "runId");
  if (!validateNight(night))
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "invalid_night" } }, 400);
  if (!validateNonEmptyString(runId))
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "invalid_run_id" } }, 400);

  const loaded = await loadPlayerBoard(db, runId, night, playerId);
  const extracted = extractBoard(c, loaded);
  if (extracted instanceof Response) return extracted;

  const opponentResult = await findOpponent(db, playerId, night);
  if (opponentResult.isErr())
    return internalError(c, "[pvp/battle:opponent]", opponentResult.error);

  const { battleId, frames, result, opponent, battleSeed, values } = buildBattleRecord(
    playerId,
    runId,
    night,
    opponentResult.value,
    extracted.board,
  );

  const saveError = await saveBattleAndVerify(db, battleId, values, runId, night);
  if (saveError) {
    if (saveError.kind === "infra") return internalError(c, saveError.label, saveError.cause);
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "battle_already_exists" } }, 409);
  }

  const churchIds = opponent.units.filter((u) => u.isChurch).map((u) => u.id);
  if (churchIds.length > 0) markSeenAsync(db, playerId, churchIds, "[pvp/battle:lore]");

  return c.json({ battleId, frames, result, opponent, seed: battleSeed });
});

export default pvp;
