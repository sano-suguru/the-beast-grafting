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
  night: number;
  life: number;
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
    boneTreeUses: state.boneTreeUses,
    rewardSlots: state.rewardSlots.map((s) =>
      s ? { unit: s.unit, frozen: s.frozen, eventSourced: s.eventSourced } : null,
    ),
    activeEvent: state.activeEvent,
    canUndo: state.undoSnapshot !== null,
    night: state.night,
    life: state.life,
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
    night: number;
    blood: number;
    freeRoll: boolean;
    cultistUsed: boolean;
    rotRingUses: number;
    boneTreeUses: number;
    corpseBrokerUses: number;
    shopUnits: (ShopSlotJson | null)[];
    shopItems: (ShopItemSlotJson | null)[];
    board: (BoardUnit | null)[];
    activeEvent: EventData | null;
    rngS0: number;
    rngS1: number;
    rewardSlots: (ShopSlotJson | null)[];
    undoSnapshot: ShopUndoSnapshot | null;
  },
  life: number,
): ShopStateRow {
  return {
    blood: row.blood,
    board: row.board,
    shopUnits: row.shopUnits,
    shopItems: row.shopItems,
    freeRoll: row.freeRoll,
    cultistUsed: row.cultistUsed,
    rotRingUses: row.rotRingUses,
    boneTreeUses: row.boneTreeUses,
    corpseBrokerUses: row.corpseBrokerUses,
    activeEvent: row.activeEvent ?? null,
    rngS0: row.rngS0,
    rngS1: row.rngS1,
    rewardSlots: row.rewardSlots,
    undoSnapshot: row.undoSnapshot ?? null,
    night: row.night,
    life,
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
    boneTreeUses: state.boneTreeUses,
    corpseBrokerUses: state.corpseBrokerUses,
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
          night: runs.night,
          life: runs.life,
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
        .where(and(eq(shopStates.runId, runId), eq(shopStates.night, run.night)))
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
      night: run.night,
      life: run.life,
      trophy: run.trophy,
      originId: parseOriginId(run.originId),
    },
    shopRow: { id: shopRow.id, version: shopRow.version },
    state: dbRowToState(shopRow, run.life),
  };
}

export async function saveShopState(
  db: DrizzleD1Database,
  shopRowId: string,
  expectedVersion: number,
  state: ShopStateRow,
  life?: number,
  runId?: string,
  playerId?: string,
): Promise<Result<unknown, InfraError | GameError>> {
  const now = new Date();
  const shopUpdate = db
    .update(shopStates)
    .set({ ...stateToColumns(state), version: expectedVersion + 1, updatedAt: now })
    .where(and(eq(shopStates.id, shopRowId), eq(shopStates.version, expectedVersion)))
    .returning({ id: shopStates.id });

  if (life !== undefined && runId && playerId) {
    const runUpdate = db
      .update(runs)
      .set({ life, updatedAt: now })
      .where(and(eq(runs.id, runId), eq(runs.playerId, playerId)));
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
  playerId: string,
  existing: number | null,
): Promise<Result<number, InfraError>> {
  if (existing != null) return ok(existing);
  const seed = generateShopSeed();
  const result = await safeAsync(
    () =>
      db
        .update(runs)
        .set({ shopSeed: seed, updatedAt: new Date() })
        .where(and(eq(runs.id, runId), eq(runs.playerId, playerId))),
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
          night: state.night,
          ...cols,
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: [shopStates.runId, shopStates.night] }),
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

export async function loadPrevNightShop(
  db: DrizzleD1Database,
  runId: string,
  currentNight: number,
): Promise<Result<PrevShopSlots, InfraError>> {
  const prevNight = currentNight - 1;
  if (prevNight < 1) return ok(EMPTY_PREV);
  const result = await safeAsync(
    () =>
      db
        .select({ shopUnits: shopStates.shopUnits, shopItems: shopStates.shopItems })
        .from(shopStates)
        .where(and(eq(shopStates.runId, runId), eq(shopStates.night, prevNight)))
        .limit(1),
    dbErr,
  );
  if (result.isErr()) return err(result.error);
  return ok(result.value[0] ?? EMPTY_PREV);
}
