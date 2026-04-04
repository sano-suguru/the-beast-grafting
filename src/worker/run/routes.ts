import { Hono } from "hono";
import type { Context } from "hono";
import { eq, and } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { safeAsync, dbErr } from "../../shared/errors";
import type { BoardUnit } from "../../shared/board-unit";
import type { RunState, CurrentRunState } from "../../shared/api-types";
import { isOriginId } from "../../shared/origin-id";
import { runs, battles } from "../../db/schema";
import { generateId } from "../auth/crypto";
import { requireAuth } from "../auth/middleware";
import type { AuthEnv } from "../auth/types";
import { jsonBody, getParsedBody, bodyField } from "../parse-json";
import { internalError } from "../error-response";
import { generateShopSeed } from "../utils/seed";
import {
  consumeAndAdvance,
  fetchBattle,
  fetchActiveRun,
  fetchLatestBoard,
  validateBattleForRun,
  computeAdvanceFields,
} from "./run-helpers";
import type { BattleRow } from "./run-helpers";
export { consumeAndAdvance };

const runRoutes = new Hono<AuthEnv>();

const INITIAL_SANITY = 5;

function findActiveRunId(db: DrizzleD1Database, playerId: string) {
  return safeAsync(
    () =>
      db
        .select({ id: runs.id })
        .from(runs)
        .where(and(eq(runs.playerId, playerId), eq(runs.status, "active")))
        .limit(1),
    dbErr,
  );
}

function validateOriginId(id: unknown): id is string | null {
  return id === null || isOriginId(id);
}

runRoutes.post("/start", requireAuth, jsonBody(), async (c) => {
  const db = c.get("db");
  const playerId = c.get("playerId");
  const originId = bodyField(getParsedBody(c), "originId");
  if (!validateOriginId(originId)) {
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "invalid_origin" } }, 400);
  }

  const existingRun = await findActiveRunId(db, playerId);
  if (existingRun.isErr()) return internalError(c, "[run/start:check]", existingRun.error);
  if (existingRun.value[0]) {
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "active_run_exists" } }, 409);
  }

  const now = new Date();
  const runId = generateId();
  const insertResult = await safeAsync(
    () =>
      db.insert(runs).values({
        id: runId,
        playerId,
        round: 1,
        sanity: INITIAL_SANITY,
        trophy: 0,
        board: [] as (BoardUnit | null)[],
        originId: originId ?? null,
        shopSeed: generateShopSeed(),
        status: "active",
        createdAt: now,
        updatedAt: now,
      }),
    dbErr,
  );
  if (insertResult.isErr()) return internalError(c, "[run/start:insert]", insertResult.error);

  const run: RunState = {
    id: runId,
    round: 1,
    sanity: INITIAL_SANITY,
    trophy: 0,
    status: "active",
    originId: originId ?? null,
  };
  return c.json({ run });
});

runRoutes.get("/current", requireAuth, async (c) => {
  const db = c.get("db");
  const playerId = c.get("playerId");

  const result = await safeAsync(
    () =>
      db
        .select({
          id: runs.id,
          round: runs.round,
          sanity: runs.sanity,
          trophy: runs.trophy,
          originId: runs.originId,
          status: runs.status,
          pendingBattleId: battles.id,
        })
        .from(runs)
        .leftJoin(
          battles,
          and(
            eq(battles.runId, runs.id),
            eq(battles.round, runs.round),
            eq(battles.consumed, false),
          ),
        )
        .where(and(eq(runs.playerId, playerId), eq(runs.status, "active")))
        .limit(1),
    dbErr,
  );
  if (result.isErr()) return internalError(c, "[run/current]", result.error);

  const row = result.value[0];
  if (!row) return c.json({ run: null });

  const run: CurrentRunState = {
    id: row.id,
    round: row.round,
    sanity: row.sanity,
    trophy: row.trophy,
    status: row.status,
    originId: row.originId,
    pendingBattleId: row.pendingBattleId ?? null,
  };
  return c.json({ run });
});

async function validateAdvanceRequest(
  c: Context<AuthEnv>,
  db: DrizzleD1Database,
  playerId: string,
  battleId: string,
): Promise<Response | { battle: BattleRow; run: typeof runs.$inferSelect }> {
  const battleResult = await fetchBattle(db, battleId);
  if (battleResult.isErr()) return internalError(c, "[run/advance:battle]", battleResult.error);
  const battle = battleResult.value[0];
  if (!battle) return c.json({ error: { type: "NOT_FOUND", entity: "battle" } }, 404);
  if (battle.playerId !== playerId)
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "not_owner" } }, 403);

  const activeRun = await fetchActiveRun(db, playerId);
  if (activeRun.isErr()) return internalError(c, "[run/advance:run]", activeRun.error);
  const run = activeRun.value[0];
  if (!run) return handleMissingRun(c, db, playerId);

  const validationError = validateBattleForRun(battle, run);
  if (validationError === "battle_already_consumed")
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: validationError } }, 409);
  if (validationError)
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: validationError } }, 400);

  return { battle, run };
}

runRoutes.post("/advance", requireAuth, jsonBody(), async (c) => {
  const db = c.get("db");
  const playerId = c.get("playerId");
  const battleId = bodyField(getParsedBody(c), "battleId");
  if (typeof battleId !== "string")
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "invalid_battle_id" } }, 400);

  const validated = await validateAdvanceRequest(c, db, playerId, battleId);
  if (validated instanceof Response) return validated;
  const { battle, run } = validated;

  const shopBoard = await fetchLatestBoard(db, run.id, battle.round);
  if (shopBoard.isErr()) return internalError(c, "[run/advance:board]", shopBoard.error);

  const fields = computeAdvanceFields(
    { ...run, board: shopBoard.value[0]?.board ?? run.board },
    battle.result,
  );
  const batchResult = await consumeAndAdvance(db, battleId, run.id, fields);
  if (batchResult.isErr()) return internalError(c, "[run/advance:batch]", batchResult.error);
  if (!batchResult.value)
    return c.json(
      { error: { type: "PRECONDITION_FAILED", reason: "battle_already_consumed" } },
      409,
    );

  return c.json({
    run: {
      id: run.id,
      round: fields.round,
      sanity: fields.sanity,
      trophy: fields.trophy,
      status: fields.status,
      originId: run.originId,
    },
  });
});

async function handleMissingRun(c: Context, db: DrizzleD1Database, playerId: string) {
  const anyRun = await safeAsync(
    () => db.select({ id: runs.id }).from(runs).where(eq(runs.playerId, playerId)).limit(1),
    dbErr,
  );
  if (anyRun.isErr()) return internalError(c, "[run/advance:run-check]", anyRun.error);
  if (anyRun.value[0])
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "run_finished" } }, 409);
  return c.json({ error: { type: "NOT_FOUND", entity: "run" } }, 404);
}

runRoutes.post("/retire", requireAuth, async (c) => {
  const db = c.get("db");
  const playerId = c.get("playerId");

  const result = await safeAsync(
    () =>
      db
        .update(runs)
        .set({ status: "retired" as const, updatedAt: new Date() })
        .where(and(eq(runs.playerId, playerId), eq(runs.status, "active")))
        .returning({ id: runs.id }),
    dbErr,
  );
  if (result.isErr()) return internalError(c, "[run/retire]", result.error);
  if (result.value.length === 0) {
    return c.json({ error: { type: "NOT_FOUND", entity: "run" } }, 404);
  }

  return c.json({ ok: true });
});

export default runRoutes;
