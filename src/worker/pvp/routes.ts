import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { safeAsync, dbErr } from "../../shared/errors";
import { warn } from "../../shared/logger";
import type { BoardUnit } from "../../shared/board-unit";
import {
  unitInstanceToBoardUnit,
  boardUnitToUnitInstance,
  pvpOpponentToEnemyTeam,
} from "../../shared/board-unit";
import type { PvpOpponent } from "../../shared/board-unit";
import type { EnemyTeam } from "../../shared/types";
import { isEquipType } from "../../shared/equip-type";
import { UNITS } from "../../shared/data/units";
import { CHURCH_UNITS } from "../../shared/data/church-units";
import type { RegularUnitId, ChurchUnitId } from "../../shared/types";
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

const pvp = new Hono<AuthEnv>();

const MAX_BOARD_SIZE = 5;
const MAX_PAYLOAD_BYTES = 10_000;
const MAX_ROUND = 20;
const STAT_CEILING_MULTIPLIER = 20;
const STAT_CEILING_BASE = 200;

function lookupMasterData(
  id: string,
): { name: string; baseAtk: number; baseHp: number; tier: number } | null {
  if (Object.hasOwn(UNITS, id)) return UNITS[id as RegularUnitId];
  if (Object.hasOwn(CHURCH_UNITS, id)) return CHURCH_UNITS[id as ChurchUnitId];
  return null;
}

function validateBoardUnit(u: unknown): u is BoardUnit {
  if (typeof u !== "object" || u === null) return false;
  const o = u as Record<string, unknown>;
  if (
    typeof o["id"] !== "string" ||
    typeof o["name"] !== "string" ||
    typeof o["baseAtk"] !== "number" ||
    typeof o["baseHp"] !== "number" ||
    typeof o["atk"] !== "number" ||
    typeof o["hp"] !== "number" ||
    typeof o["tier"] !== "number" ||
    typeof o["level"] !== "number" ||
    typeof o["exp"] !== "number" ||
    !(isEquipType(o["equip"]) || o["equip"] === null) ||
    typeof o["uid"] !== "string" ||
    typeof o["isChurch"] !== "boolean" ||
    typeof o["skillText"] !== "string" ||
    typeof o["lore"] !== "string"
  )
    return false;

  const uid = o["uid"] as string;
  if (uid.length === 0 || uid.length > 32) return false;

  const exp = o["exp"] as number;
  if (!Number.isInteger(exp) || exp < 0 || exp > 2) return false;

  const id = o["id"] as string;
  const master = lookupMasterData(id);
  if (!master) return false;
  if (o["name"] !== master.name) return false;
  if (o["tier"] !== master.tier) return false;
  if (o["baseAtk"] !== master.baseAtk || o["baseHp"] !== master.baseHp) return false;

  const isFromChurch = Object.hasOwn(CHURCH_UNITS, id);
  if (o["isChurch"] !== isFromChurch) return false;

  const level = o["level"] as number;
  if (!Number.isInteger(level) || level < 1 || level > 3) return false;

  const atk = o["atk"] as number;
  const hp = o["hp"] as number;
  if (atk < master.baseAtk || hp < master.baseHp) return false;

  const atkCeiling = master.baseAtk * STAT_CEILING_MULTIPLIER + STAT_CEILING_BASE;
  const hpCeiling = master.baseHp * STAT_CEILING_MULTIPLIER + STAT_CEILING_BASE;
  if (atk > atkCeiling || hp > hpCeiling) return false;

  return true;
}

function validateSnapshotBody(
  body: unknown,
): body is { runId: string; round: number; board: BoardUnit[] } {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b["runId"] !== "string" || b["runId"].length === 0) return false;
  if (typeof b["round"] !== "number" || b["round"] < 1 || !Number.isInteger(b["round"]))
    return false;
  if (b["round"] > MAX_ROUND) return false;
  if (!Array.isArray(b["board"]) || b["board"].length < 1 || b["board"].length > MAX_BOARD_SIZE)
    return false;
  if (!b["board"].every(validateBoardUnit)) return false;
  return true;
}

pvp.post("/snapshot", requireAuth, jsonBody(MAX_PAYLOAD_BYTES), async (c) => {
  const db = c.get("db");
  const playerId = c.get("playerId");

  const body = getParsedBody(c);
  if (!validateSnapshotBody(body)) {
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "invalid_snapshot" } }, 400);
  }

  const runCheck = await safeAsync(
    () =>
      db
        .select({ id: runs.id })
        .from(runs)
        .where(and(eq(runs.id, body.runId), eq(runs.playerId, playerId), eq(runs.status, "active")))
        .limit(1),
    dbErr,
  );
  if (runCheck.isErr()) return internalError(c, "[pvp/snapshot:run]", runCheck.error);
  if (!runCheck.value[0]) {
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "invalid_run" } }, 400);
  }

  const upsertResult = await safeAsync(
    () =>
      db
        .insert(boardSnapshots)
        .values({
          id: generateId(),
          playerId,
          runId: body.runId,
          round: body.round,
          board: body.board,
          createdAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [boardSnapshots.runId, boardSnapshots.round],
          set: {
            board: body.board,
            createdAt: new Date(),
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

function validateRound(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_ROUND;
}

pvp.post("/battle", requireAuth, jsonBody(), async (c) => {
  const db = c.get("db");
  const playerId = c.get("playerId");
  const parsedBody = getParsedBody(c);
  const round = bodyField(parsedBody, "round");
  const runId = bodyField(parsedBody, "runId");
  if (!validateRound(round)) {
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "invalid_round" } }, 400);
  }
  if (typeof runId !== "string" || runId.length === 0) {
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "invalid_run_id" } }, 400);
  }

  const runCheck = await safeAsync(
    () =>
      db
        .select({ id: runs.id })
        .from(runs)
        .where(and(eq(runs.id, runId), eq(runs.playerId, playerId), eq(runs.status, "active")))
        .limit(1),
    dbErr,
  );
  if (runCheck.isErr()) return internalError(c, "[pvp/battle:run]", runCheck.error);
  if (!runCheck.value[0]) {
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "invalid_run" } }, 400);
  }

  const snapshotResult = await safeAsync(
    () =>
      db
        .select({ board: boardSnapshots.board })
        .from(boardSnapshots)
        .where(and(eq(boardSnapshots.runId, runId), eq(boardSnapshots.round, round)))
        .limit(1),
    dbErr,
  );
  if (snapshotResult.isErr())
    return internalError(c, "[pvp/battle:snapshot]", snapshotResult.error);

  const snapshot = snapshotResult.value[0];
  if (!snapshot) {
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "no_snapshot" } }, 400);
  }

  const playerBoard = snapshot.board.map(boardUnitToUnitInstance);

  const opponentResult = await findOpponent(db, playerId, round);
  if (opponentResult.isErr())
    return internalError(c, "[pvp/battle:opponent]", opponentResult.error);

  const pvpOpponent = opponentResult.value;
  const battleSeed = generateBattleSeed();
  let enemy: EnemyTeam;
  const opponentPlayerId = pvpOpponent?.playerId ?? null;
  if (pvpOpponent) {
    enemy = pvpOpponentToEnemyTeam(pvpOpponent);
  } else {
    const enemySeed = generateBattleSeed();
    enemy = generateEnemyTeam(round, createSeededRng(enemySeed));
  }

  const existingBattle = await safeAsync(
    () =>
      db
        .select({ id: battles.id, result: battles.result, seed: battles.seed })
        .from(battles)
        .where(and(eq(battles.runId, runId), eq(battles.round, round)))
        .limit(1),
    dbErr,
  );
  if (existingBattle.isErr()) return internalError(c, "[pvp/battle:check]", existingBattle.error);
  if (existingBattle.value[0]) {
    warn("[pvp/battle] battle_already_exists", {
      runId,
      round,
      existingId: existingBattle.value[0].id,
    });
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "battle_already_exists" } }, 409);
  }

  const { frames, result } = simulateBattle(playerBoard, enemy, round, battleSeed);

  const opponent: PvpOpponent = {
    playerId: opponentPlayerId,
    teamName: enemy.teamName,
    teamType: enemy.teamType,
    units: enemy.units.map(unitInstanceToBoardUnit),
  };

  const battleId = generateId();
  const saveResult = await safeAsync(
    () =>
      db
        .insert(battles)
        .values({
          id: battleId,
          playerId,
          runId,
          opponentPlayerId,
          round,
          seed: battleSeed,
          opponent,
          result: result ?? "DRAW",
          createdAt: new Date(),
        })
        .onConflictDoNothing({ target: [battles.runId, battles.round] }),
    dbErr,
  );
  if (saveResult.isErr()) return internalError(c, "[pvp/battle:insert]", saveResult.error);

  const verifyInsert = await safeAsync(
    () =>
      db
        .select({ id: battles.id })
        .from(battles)
        .where(and(eq(battles.runId, runId), eq(battles.round, round)))
        .limit(1),
    dbErr,
  );
  if (verifyInsert.isErr()) return internalError(c, "[pvp/battle:verify]", verifyInsert.error);
  if (verifyInsert.value[0]?.id !== battleId) {
    warn("[pvp/battle] race: battle_already_exists", {
      runId,
      round,
      battleId,
      actualId: verifyInsert.value[0]?.id,
    });
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "battle_already_exists" } }, 409);
  }

  return c.json({ battleId, frames, result, opponent, seed: battleSeed });
});

export default pvp;
