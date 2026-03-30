import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { safeAsync, dbErr } from "../../shared/errors";
import type { BoardUnit } from "../../shared/board-unit";
import type { RunState, RunStatus } from "../../shared/api-types";
import { isOriginId } from "../../shared/origin-id";
import { runs, battles, boardSnapshots } from "../../db/schema";
import { generateId } from "../auth/crypto";
import { requireAuth } from "../auth/middleware";
import type { AuthEnv } from "../auth/types";
import { jsonBody, getParsedBody, bodyField } from "../parse-json";
import { internalError } from "../error-response";

import type { DrizzleD1Database } from "drizzle-orm/d1";

const runRoutes = new Hono<AuthEnv>();

const INITIAL_SANITY = 5;
const WIN_THRESHOLD = 10;

interface AdvanceFields {
  round: number;
  sanity: number;
  trophy: number;
  board: BoardUnit[];
  status: RunStatus;
}

/** Consume a battle then advance the run. Returns false if already consumed. */
export function consumeAndAdvance(
  db: DrizzleD1Database,
  battleId: string,
  runId: string,
  fields: AdvanceFields,
) {
  return safeAsync(async () => {
    const consumeRows = await db
      .update(battles)
      .set({ consumed: true })
      .where(and(eq(battles.id, battleId), eq(battles.consumed, false)))
      .returning({ id: battles.id });
    if (consumeRows.length === 0) return false;

    await db
      .update(runs)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(runs.id, runId));
    return true;
  }, dbErr);
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

  const existingRun = await safeAsync(
    () =>
      db
        .select({ id: runs.id })
        .from(runs)
        .where(and(eq(runs.playerId, playerId), eq(runs.status, "active")))
        .limit(1),
    dbErr,
  );
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
        board: [] as BoardUnit[],
        originId: originId ?? null,
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
          board: runs.board,
          originId: runs.originId,
          status: runs.status,
        })
        .from(runs)
        .where(and(eq(runs.playerId, playerId), eq(runs.status, "active")))
        .limit(1),
    dbErr,
  );
  if (result.isErr()) return internalError(c, "[run/current]", result.error);

  return c.json({ run: result.value[0] ?? null });
});

runRoutes.post("/advance", requireAuth, jsonBody(), async (c) => {
  const db = c.get("db");
  const playerId = c.get("playerId");
  const battleId = bodyField(getParsedBody(c), "battleId");
  if (typeof battleId !== "string") {
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "invalid_battle_id" } }, 400);
  }

  const battleResult = await safeAsync(
    () =>
      db
        .select({
          result: battles.result,
          playerId: battles.playerId,
          runId: battles.runId,
          round: battles.round,
          consumed: battles.consumed,
        })
        .from(battles)
        .where(eq(battles.id, battleId))
        .limit(1),
    dbErr,
  );
  if (battleResult.isErr()) return internalError(c, "[run/advance:battle]", battleResult.error);

  const battle = battleResult.value[0];
  if (!battle) return c.json({ error: { type: "NOT_FOUND", entity: "battle" } }, 404);
  if (battle.playerId !== playerId) {
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "not_owner" } }, 403);
  }
  const activeRun = await safeAsync(
    () =>
      db
        .select()
        .from(runs)
        .where(and(eq(runs.playerId, playerId), eq(runs.status, "active")))
        .limit(1),
    dbErr,
  );
  if (activeRun.isErr()) return internalError(c, "[run/advance:run]", activeRun.error);

  const run = activeRun.value[0];
  if (!run) {
    const anyRun = await safeAsync(
      () => db.select({ id: runs.id }).from(runs).where(eq(runs.playerId, playerId)).limit(1),
      dbErr,
    );
    if (anyRun.isErr()) return internalError(c, "[run/advance:run-check]", anyRun.error);
    if (anyRun.value[0]) {
      return c.json({ error: { type: "PRECONDITION_FAILED", reason: "run_finished" } }, 409);
    }
    return c.json({ error: { type: "NOT_FOUND", entity: "run" } }, 404);
  }

  if (battle.runId !== run.id) {
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "run_mismatch" } }, 400);
  }
  if (battle.round !== run.round) {
    return c.json({ error: { type: "PRECONDITION_FAILED", reason: "round_mismatch" } }, 400);
  }
  if (battle.consumed) {
    return c.json(
      { error: { type: "PRECONDITION_FAILED", reason: "battle_already_consumed" } },
      409,
    );
  }

  let newSanity = run.sanity;
  let newTrophy = run.trophy;
  let newStatus: RunStatus = run.status;

  if (battle.result === "WIN") {
    newTrophy += 1;
    if (newTrophy >= WIN_THRESHOLD) newStatus = "won";
  } else if (battle.result === "LOSE") {
    newSanity -= 1;
    if (newSanity <= 0) {
      newSanity = 0;
      newStatus = "lost";
    }
  }

  const newRound = newStatus === "active" ? run.round + 1 : run.round;

  const latestBoard = await safeAsync(
    () =>
      db
        .select({ board: boardSnapshots.board })
        .from(boardSnapshots)
        .where(and(eq(boardSnapshots.runId, run.id), eq(boardSnapshots.round, battle.round)))
        .limit(1),
    dbErr,
  );
  if (latestBoard.isErr()) return internalError(c, "[run/advance:board]", latestBoard.error);

  const boardData = latestBoard.value[0]?.board ?? run.board;

  const batchResult = await consumeAndAdvance(db, battleId, run.id, {
    round: newRound,
    sanity: newSanity,
    trophy: newTrophy,
    board: boardData,
    status: newStatus,
  });
  if (batchResult.isErr()) return internalError(c, "[run/advance:batch]", batchResult.error);

  if (!batchResult.value) {
    return c.json(
      { error: { type: "PRECONDITION_FAILED", reason: "battle_already_consumed" } },
      409,
    );
  }

  const updatedRun: RunState = {
    id: run.id,
    round: newRound,
    sanity: newSanity,
    trophy: newTrophy,
    status: newStatus,
    originId: run.originId,
  };
  return c.json({ run: updatedRun });
});

export default runRoutes;
