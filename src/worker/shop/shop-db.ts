import { eq, and } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { safeAsync, dbErr, err, ok } from "../../shared/errors";
import { invariant } from "../../shared/invariant";
import type { Result, InfraError, GameError } from "../../shared/errors";
import type { OriginId } from "../../shared/types";
import { isOriginId } from "../../shared/origin-id";
import type { BoardUnit } from "../../shared/board-unit";
import type { ShopStateResponse } from "../../shared/api-types";
import { runs, shopStates } from "../../db/schema";
import type { ShopSlotJson, ShopItemSlotJson, ShopUndoSnapshot } from "../../db/shop-state-types";
import type { EventData } from "../../shared/types";
import { ITEMS } from "../../shared/data/items";
import { generateId } from "../auth/crypto";
import { generateShopSeed } from "../utils/seed";
import type { ShopStateRow } from "./shop-state-row";

export type RunInfo = {
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

export function toResponse(state: ShopStateRow, trophy: number): ShopStateResponse {
  return {
    blood: state.blood,
    board: state.board,
    shopUnits: state.shopUnits.map((s) =>
      s
        ? {
            unit: s.unit,
            frozen: s.frozen,
            ...(s.costOverride !== undefined ? { costOverride: s.costOverride } : {}),
            eventSourced: s.eventSourced,
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
    rewardSlots: state.rewardSlots.map((s) =>
      s ? { unit: s.unit, frozen: s.frozen, eventSourced: s.eventSourced } : null,
    ),
    activeEvent: state.activeEvent,
    canUndo: state.undoSnapshot !== null,
    round: state.round,
    sanity: state.sanity,
    trophy,
  };
}

export function parseOriginId(value: string | null): OriginId | null {
  if (value == null) return null;
  invariant(isOriginId(value), `invalid originId in DB: ${value}`);
  return value;
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
    rewardSlots: (ShopSlotJson | null)[];
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
    rewardSlots: row.rewardSlots,
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

export function activeRunFilter(runId: string, playerId: string) {
  return and(eq(runs.id, runId), eq(runs.playerId, playerId), eq(runs.status, "active"));
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
    rewardSlots: state.rewardSlots,
    undoSnapshot: state.undoSnapshot,
  };
}

export async function loadShopState(
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

export async function saveShopState(
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

export async function ensureShopSeed(
  db: DrizzleD1Database,
  runId: string,
  existing: number | null,
): Promise<Result<number, InfraError>> {
  if (existing != null) return ok(existing);
  const seed = generateShopSeed();
  const result = await safeAsync(
    () => db.update(runs).set({ shopSeed: seed, updatedAt: new Date() }).where(eq(runs.id, runId)),
    dbErr,
  );
  return result.isErr() ? err(result.error) : ok(seed);
}

export function upsertShopState(db: DrizzleD1Database, runId: string, state: ShopStateRow) {
  const cols = stateToColumns(state);
  const now = new Date();
  return safeAsync(
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
}

export function normalizePrevBoard(board: (BoardUnit | null)[]): (BoardUnit | null)[] {
  return board.length === 5 ? board : padBoard(board.filter((u): u is BoardUnit => u !== null));
}

interface PrevShopSlots {
  shopUnits: (ShopSlotJson | null)[];
  shopItems: (ShopItemSlotJson | null)[];
}

const EMPTY_PREV: PrevShopSlots = { shopUnits: [], shopItems: [] };

export async function loadPrevRoundShop(
  db: DrizzleD1Database,
  runId: string,
  currentRound: number,
): Promise<Result<PrevShopSlots, InfraError>> {
  const prevRound = currentRound - 1;
  if (prevRound < 1) return ok(EMPTY_PREV);
  const result = await safeAsync(
    () =>
      db
        .select({ shopUnits: shopStates.shopUnits, shopItems: shopStates.shopItems })
        .from(shopStates)
        .where(and(eq(shopStates.runId, runId), eq(shopStates.round, prevRound)))
        .limit(1),
    dbErr,
  );
  if (result.isErr()) return err(result.error);
  return ok(result.value[0] ?? EMPTY_PREV);
}
