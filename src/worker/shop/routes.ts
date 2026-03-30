import { Hono } from "hono";
import type { Context } from "hono";
import { eq, and } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { safeAsync, dbErr, err, ok } from "../../shared/errors";
import { invariant } from "../../shared/invariant";
import type { Result, InfraError, GameError } from "../../shared/errors";
import type { OriginId } from "../../shared/types";
import { isOriginId } from "../../shared/origin-id";
import type { BoardUnit } from "../../shared/board-unit";
import type { ShopStateResponse } from "../../shared/api-types";
import { runs, shopStates, boardSnapshots } from "../../db/schema";
import type { ShopSlotJson, ShopItemSlotJson, ShopUndoSnapshot } from "../../db/shop-state-types";
import type { EventData } from "../../shared/types";
import { generateId } from "../auth/crypto";
import { requireAuth } from "../auth/middleware";
import type { AuthEnv } from "../auth/types";
import { jsonBody, getParsedBody, bodyField } from "../parse-json";
import { internalError } from "../error-response";
import { ITEMS } from "../../shared/data/items";
import { generateShopSeed } from "../utils/seed";
import {
  executeSetup,
  executeRoll,
  executeBuy,
  executeSell,
  executeEquip,
  executeFreeze,
  executeSwap,
  executeCultist,
  executeDismissEvent,
  executeUndo,
  executeReady,
} from "./shop-service";
import type { ShopStateRow } from "./shop-service";

const shopRoutes = new Hono<AuthEnv>();

function toResponse(state: ShopStateRow, trophy: number): ShopStateResponse {
  return {
    blood: state.blood,
    board: state.board,
    shopUnits: state.shopUnits.map((s) =>
      s
        ? {
            unit: s.unit,
            frozen: s.frozen,
            ...(s.costOverride !== undefined ? { costOverride: s.costOverride } : {}),
          }
        : null,
    ),
    shopItems: state.shopItems.map((s) => {
      if (!s) return null;
      const item = ITEMS[s.itemId as keyof typeof ITEMS];
      invariant(item != null, `unknown itemId in shop state: ${s.itemId}`);
      return { item, frozen: s.frozen };
    }),
    freeRoll: state.freeRoll,
    cultistUsed: state.cultistUsed,
    rotRingUses: state.rotRingUses,
    activeEvent: state.activeEvent,
    canUndo: state.undoSnapshot !== null,
    round: state.round,
    sanity: state.sanity,
    trophy,
  };
}

function parseOriginId(value: string | null): OriginId | null {
  if (value == null) return null;
  invariant(isOriginId(value), `invalid originId in DB: ${value}`);
  return value;
}

function validateRunId(body: unknown): string | null {
  const runId = bodyField(body, "runId");
  return typeof runId === "string" ? runId : null;
}

function validateIndex(body: unknown, key: string, max?: number): number | null {
  const val = bodyField(body, key);
  if (typeof val !== "number" || !Number.isInteger(val) || val < 0) return null;
  if (max !== undefined && val > max) return null;
  return val;
}

function validateBoolean(body: unknown, key: string): boolean | null {
  const val = bodyField(body, key);
  return typeof val === "boolean" ? val : null;
}

function dbRowToState(
  row: {
    round: number;
    blood: number;
    freeRoll: boolean;
    cultistUsed: boolean;
    rotRingUses: number;
    shopUnits: (ShopSlotJson | null)[];
    shopItems: (ShopItemSlotJson | null)[];
    board: (BoardUnit | null)[];
    activeEvent: EventData | null;
    rngS0: number;
    rngS1: number;
    undoSnapshot: ShopUndoSnapshot | null;
  },
  sanity: number,
): ShopStateRow {
  return {
    blood: row.blood,
    board: row.board,
    shopUnits: row.shopUnits,
    shopItems: row.shopItems,
    freeRoll: row.freeRoll,
    cultistUsed: row.cultistUsed,
    rotRingUses: row.rotRingUses,
    activeEvent: row.activeEvent ?? null,
    rngS0: row.rngS0,
    rngS1: row.rngS1,
    undoSnapshot: row.undoSnapshot ?? null,
    round: row.round,
    sanity,
  };
}

function padBoard(b: BoardUnit[]): (BoardUnit | null)[] {
  invariant(b.length <= 5, `padBoard: board length ${b.length} exceeds max 5`);
  const result: (BoardUnit | null)[] = [null, null, null, null, null];
  for (let i = 0; i < b.length; i++) {
    result[i] = b[i]!;
  }
  return result;
}

type RunInfo = {
  id: string;
  round: number;
  sanity: number;
  trophy: number;
  originId: OriginId | null;
};

type LoadResult =
  | { type: "error"; error: unknown; label: string }
  | { type: "not_found"; entity: string }
  | { type: "ok"; run: RunInfo; shopRow: { id: string; version: number }; state: ShopStateRow };

function activeRunFilter(runId: string, playerId: string) {
  return and(eq(runs.id, runId), eq(runs.playerId, playerId), eq(runs.status, "active"));
}

async function loadShopState(
  db: DrizzleD1Database,
  playerId: string,
  runId: string,
): Promise<LoadResult> {
  const runResult = await safeAsync(
    () =>
      db
        .select({
          id: runs.id,
          round: runs.round,
          sanity: runs.sanity,
          trophy: runs.trophy,
          originId: runs.originId,
          status: runs.status,
        })
        .from(runs)
        .where(activeRunFilter(runId, playerId))
        .limit(1),
    dbErr,
  );
  if (runResult.isErr()) return { type: "error", error: runResult.error, label: "[shop:run]" };
  const run = runResult.value[0];
  if (!run) return { type: "not_found", entity: "run" };

  const shopResult = await safeAsync(
    () =>
      db
        .select()
        .from(shopStates)
        .where(and(eq(shopStates.runId, runId), eq(shopStates.round, run.round)))
        .limit(1),
    dbErr,
  );
  if (shopResult.isErr()) return { type: "error", error: shopResult.error, label: "[shop:state]" };
  const shopRow = shopResult.value[0];
  if (!shopRow) return { type: "not_found", entity: "shop_state" };

  return {
    type: "ok",
    run: {
      id: run.id,
      round: run.round,
      sanity: run.sanity,
      trophy: run.trophy,
      originId: parseOriginId(run.originId),
    },
    shopRow: { id: shopRow.id, version: shopRow.version },
    state: dbRowToState(shopRow, run.sanity),
  };
}

function stateToColumns(state: ShopStateRow) {
  return {
    blood: state.blood,
    freeRoll: state.freeRoll,
    cultistUsed: state.cultistUsed,
    rotRingUses: state.rotRingUses,
    shopUnits: state.shopUnits,
    shopItems: state.shopItems,
    board: state.board,
    activeEvent: state.activeEvent,
    rngS0: state.rngS0,
    rngS1: state.rngS1,
    undoSnapshot: state.undoSnapshot,
  };
}

async function saveShopState(
  db: DrizzleD1Database,
  shopRowId: string,
  expectedVersion: number,
  state: ShopStateRow,
  sanity?: number,
  runId?: string,
): Promise<Result<unknown, InfraError | GameError>> {
  const now = new Date();
  const shopUpdate = db
    .update(shopStates)
    .set({ ...stateToColumns(state), version: expectedVersion + 1, updatedAt: now })
    .where(and(eq(shopStates.id, shopRowId), eq(shopStates.version, expectedVersion)))
    .returning({ id: shopStates.id });

  if (sanity !== undefined && runId) {
    const runUpdate = db.update(runs).set({ sanity, updatedAt: now }).where(eq(runs.id, runId));
    const batchResult = await safeAsync(() => db.batch([shopUpdate, runUpdate] as const), dbErr);
    if (batchResult.isErr()) return batchResult;
    const [shopRows] = batchResult.value;
    if (shopRows.length === 0)
      return err({ type: "CONFLICT" as const, reason: "version_mismatch" });
    return ok(shopRows);
  }

  const updateResult = await safeAsync(() => shopUpdate, dbErr);
  if (updateResult.isErr()) return updateResult;
  if (updateResult.value.length === 0)
    return err({ type: "CONFLICT" as const, reason: "version_mismatch" });
  return updateResult;
}

function preconditionFailed(reason: string) {
  return { error: { type: "PRECONDITION_FAILED" as const, reason } } as const;
}

shopRoutes.post("/setup", requireAuth, jsonBody(), async (c) => {
  const db = c.get("db");
  const playerId = c.get("playerId");
  const body = getParsedBody(c);
  const runId = validateRunId(body);
  if (!runId) return c.json(preconditionFailed("invalid_run_id"), 400);

  const useTutorialShop = bodyField(body, "useTutorialShop") === true;

  const runResult = await safeAsync(
    () => db.select().from(runs).where(activeRunFilter(runId, playerId)).limit(1),
    dbErr,
  );
  if (runResult.isErr()) return internalError(c, "[shop/setup:run]", runResult.error);
  const run = runResult.value[0];
  if (!run) return c.json({ error: { type: "NOT_FOUND", entity: "run" } }, 404);

  const shopSeed = run.shopSeed ?? generateShopSeed();
  if (!run.shopSeed) {
    const seedResult = await safeAsync(
      () => db.update(runs).set({ shopSeed, updatedAt: new Date() }).where(eq(runs.id, runId)),
      dbErr,
    );
    if (seedResult.isErr()) return internalError(c, "[shop/setup:seed]", seedResult.error);
  }

  const prevBoard: (BoardUnit | null)[] =
    run.board.length === 5
      ? run.board
      : padBoard(run.board.filter((u): u is BoardUnit => u !== null));

  const state = executeSetup(
    run.round,
    run.sanity,
    parseOriginId(run.originId),
    shopSeed,
    prevBoard,
    useTutorialShop,
  );

  const now = new Date();
  const cols = stateToColumns(state);
  const insertResult = await safeAsync(
    () =>
      db
        .insert(shopStates)
        .values({
          id: generateId(),
          runId,
          round: state.round,
          ...cols,
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [shopStates.runId, shopStates.round],
          set: { ...cols, version: 1, updatedAt: now },
        }),
    dbErr,
  );
  if (insertResult.isErr()) return internalError(c, "[shop/setup:insert]", insertResult.error);

  return c.json({ shop: toResponse(state, run.trophy) });
});

type ShopActionOk = ShopStateRow | { state: ShopStateRow; finalBoard: (BoardUnit | null)[] };

function isWithBoard(
  v: ShopActionOk,
): v is { state: ShopStateRow; finalBoard: (BoardUnit | null)[] } {
  return "finalBoard" in v;
}

type ShopActionErr = { type: string; [key: string]: unknown };

async function runShopAction(
  c: Context,
  db: DrizzleD1Database,
  playerId: string,
  runId: string,
  handler: (state: ShopStateRow, run: RunInfo) => Result<ShopActionOk, ShopActionErr>,
) {
  const loaded = await loadShopState(db, playerId, runId);
  if (loaded.type === "error") return internalError(c as never, loaded.label, loaded.error);
  if (loaded.type === "not_found")
    return c.json({ error: { type: "NOT_FOUND", entity: loaded.entity } }, 404);

  const { run, shopRow, state } = loaded;
  const result = handler(state, run);
  if (result.isErr()) return c.json({ error: result.error }, 400);

  const value = result.value;
  const newState = isWithBoard(value) ? value.state : value;
  const sanityChanged = newState.sanity !== run.sanity ? newState.sanity : undefined;
  const saveResult = await saveShopState(
    db,
    shopRow.id,
    shopRow.version,
    newState,
    sanityChanged,
    sanityChanged !== undefined ? run.id : undefined,
  );
  if (saveResult.isErr()) {
    const e = saveResult.error;
    if (e.type === "CONFLICT")
      return c.json({ error: { type: "CONFLICT", reason: e.reason } }, 409);
    return internalError(c as never, "[shop:save]", e);
  }

  // boardSnapshotはready時のみ作成（ラウンド確定盤面を1つ保存する設計。(runId, round)ユニーク制約）
  if (isWithBoard(value)) {
    const boardUnits = value.finalBoard.filter((u): u is BoardUnit => u !== null);
    const now = new Date();
    const snapResult = await safeAsync(
      () =>
        db
          .insert(boardSnapshots)
          .values({
            id: generateId(),
            playerId,
            runId,
            round: run.round,
            board: boardUnits,
            createdAt: now,
          })
          .onConflictDoUpdate({
            target: [boardSnapshots.runId, boardSnapshots.round],
            set: { board: boardUnits, createdAt: now },
          }),
      dbErr,
    );
    if (snapResult.isErr()) return internalError(c as never, "[shop:snapshot]", snapResult.error);
  }

  return c.json({ shop: toResponse(newState, run.trophy) });
}

function parseContext(c: Context) {
  const db = c.get("db");
  const playerId = c.get("playerId") as string;
  const body = getParsedBody(c);
  const runId = validateRunId(body);
  return { db, playerId, body, runId };
}

function shopAction(
  c: Context,
  handler: (state: ShopStateRow, run: RunInfo) => Result<ShopActionOk, ShopActionErr>,
) {
  const { db, playerId, runId } = parseContext(c);
  if (!runId) return c.json(preconditionFailed("invalid_run_id"), 400);
  return runShopAction(c, db, playerId, runId, handler);
}

function shopActionWithParams<T>(
  c: Context,
  parseExtra: (body: unknown) => T | null,
  handler: (state: ShopStateRow, run: RunInfo, extra: T) => Result<ShopActionOk, ShopActionErr>,
  parseError?: string,
) {
  const { db, playerId, body, runId } = parseContext(c);
  if (!runId) return c.json(preconditionFailed("invalid_run_id"), 400);
  const extra = parseExtra(body);
  if (extra === null) return c.json(preconditionFailed(parseError ?? "invalid_params"), 400);
  return runShopAction(c, db, playerId, runId, (state, run) => handler(state, run, extra));
}

shopRoutes.post("/roll", requireAuth, jsonBody(), (c) =>
  shopAction(c, (state, run) => executeRoll(state, run.originId)),
);

shopRoutes.post("/buy", requireAuth, jsonBody(), (c) =>
  shopActionWithParams(
    c,
    (body) => {
      const shopIndex = validateIndex(body, "shopIndex");
      const boardIndex = validateIndex(body, "boardIndex", 4);
      return shopIndex !== null && boardIndex !== null ? { shopIndex, boardIndex } : null;
    },
    (state, _run, { shopIndex, boardIndex }) => executeBuy(state, shopIndex, boardIndex),
    "invalid_index",
  ),
);

shopRoutes.post("/sell", requireAuth, jsonBody(), (c) =>
  shopActionWithParams(
    c,
    (body) => {
      const boardIndex = validateIndex(body, "boardIndex", 4);
      return boardIndex !== null ? { boardIndex } : null;
    },
    (state, run, { boardIndex }) => executeSell(state, boardIndex, run.originId),
    "invalid_index",
  ),
);

shopRoutes.post("/equip", requireAuth, jsonBody(), (c) =>
  shopActionWithParams(
    c,
    (body) => {
      const shopItemIndex = validateIndex(body, "shopItemIndex");
      const boardIndex = validateIndex(body, "boardIndex", 4);
      return shopItemIndex !== null && boardIndex !== null ? { shopItemIndex, boardIndex } : null;
    },
    (state, _run, { shopItemIndex, boardIndex }) => executeEquip(state, shopItemIndex, boardIndex),
    "invalid_index",
  ),
);

shopRoutes.post("/freeze", requireAuth, jsonBody(), (c) =>
  shopActionWithParams(
    c,
    (body) => {
      const isUnit = validateBoolean(body, "isUnit");
      const index = validateIndex(body, "index");
      const frozen = validateBoolean(body, "frozen");
      return isUnit !== null && index !== null && frozen !== null
        ? { isUnit, index, frozen }
        : null;
    },
    (state, _run, { isUnit, index, frozen }) => executeFreeze(state, isUnit, index, frozen),
  ),
);

shopRoutes.post("/swap", requireAuth, jsonBody(), (c) =>
  shopActionWithParams(
    c,
    (body) => {
      const fromIndex = validateIndex(body, "fromIndex", 4);
      const toIndex = validateIndex(body, "toIndex", 4);
      return fromIndex !== null && toIndex !== null ? { fromIndex, toIndex } : null;
    },
    (state, _run, { fromIndex, toIndex }) => executeSwap(state, fromIndex, toIndex),
    "invalid_index",
  ),
);

shopRoutes.post("/cultist", requireAuth, jsonBody(), (c) =>
  shopAction(c, (state, run) => executeCultist(state, run.originId)),
);

shopRoutes.post("/dismiss-event", requireAuth, jsonBody(), (c) =>
  shopAction(c, (state, run) => executeDismissEvent(state, run.originId)),
);

shopRoutes.post("/undo", requireAuth, jsonBody(), (c) =>
  shopAction(c, (state) => executeUndo(state)),
);

shopRoutes.post("/ready", requireAuth, jsonBody(), (c) =>
  shopAction(c, (state) => executeReady(state)),
);

shopRoutes.get("/state", requireAuth, async (c) => {
  const db = c.get("db");
  const playerId = c.get("playerId") as string;
  const runId = c.req.query("runId");
  if (!runId) return c.json(preconditionFailed("invalid_run_id"), 400);

  const loaded = await loadShopState(db, playerId, runId);
  if (loaded.type === "error") return internalError(c as never, "[shop:state]", loaded.error);
  if (loaded.type === "not_found")
    return c.json({ error: { type: "NOT_FOUND", entity: loaded.entity } }, 404);
  return c.json({ shop: toResponse(loaded.state, loaded.run.trophy) });
});

export default shopRoutes;
