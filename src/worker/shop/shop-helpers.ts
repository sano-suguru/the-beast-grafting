import type { Context } from "hono";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { ok, err, safeAsync, dbErr } from "../../shared/errors";
import type { Result, GameError } from "../../shared/errors";
import type { UnitInstance } from "../../shared/types";
import type { BoardUnit } from "../../shared/board-unit";
import type { StatefulRng } from "../../engine/rng";
import { restoreRng } from "../../engine/rng";
import { graftUnits, applySummonEffects } from "../../engine/shop-effects";
import type { ShopUndoSnapshot } from "../../db/shop-state-types";
import { boardSnapshots } from "../../db/schema";
import { generateId } from "../auth/crypto";
import { getParsedBody, bodyField } from "../parse-json";
import { internalError } from "../error-response";
import type { ShopStateRow } from "./shop-state-row";
import { toResponse, loadShopState, saveShopState } from "./shop-db";
import type { RunInfo } from "./shop-db";

interface PlaceResult {
  board: (UnitInstance | null)[];
  leveledUp: boolean;
}

export function captureUndo(state: ShopStateRow): ShopUndoSnapshot {
  return {
    blood: state.blood,
    board: state.board,
    shopUnits: state.shopUnits,
    shopItems: state.shopItems,
    freeRoll: state.freeRoll,
    cultistUsed: state.cultistUsed,
    rotRingUses: state.rotRingUses,
    boneTreeUses: state.boneTreeUses,
    corpseBrokerUses: state.corpseBrokerUses,
    activeEvent: state.activeEvent,
    rngS0: state.rngS0,
    rngS1: state.rngS1,
    life: state.life,
    rewardSlots: state.rewardSlots,
  };
}

export function placeUnitOnBoard(
  unit: UnitInstance,
  currentBoard: (UnitInstance | null)[],
  boardIndex: number,
): Result<PlaceResult, GameError> {
  const target = currentBoard[boardIndex] ?? null;
  if (!target) {
    const placed = [...currentBoard];
    placed[boardIndex] = unit;
    return ok({ board: applySummonEffects(boardIndex, placed), leveledUp: false });
  }
  if (target.id === unit.id && target.level < 3) {
    const graft = graftUnits(target, unit);
    const board = [...currentBoard];
    board[boardIndex] = graft.unit;
    return ok({ board, leveledUp: graft.leveledUp });
  }
  return err({ type: "INVALID_TARGET", reason: "incompatible_unit" });
}

export function withRng(state: ShopStateRow): {
  rng: StatefulRng;
  saveRng: () => Pick<ShopStateRow, "rngS0" | "rngS1">;
} {
  const rng = restoreRng({ s0: state.rngS0, s1: state.rngS1 });
  return {
    rng,
    saveRng: () => {
      const s = rng.getState();
      return { rngS0: s.s0, rngS1: s.s1 };
    },
  };
}

// --- Route orchestration helpers (extracted from routes.ts) ---

export function validateRunId(body: unknown): string | null {
  const runId = bodyField(body, "runId");
  return typeof runId === "string" ? runId : null;
}

export function validateIndex(body: unknown, key: string, maxInclusive?: number): number | null {
  const val = bodyField(body, key);
  if (typeof val !== "number" || !Number.isInteger(val) || val < 0) return null;
  if (maxInclusive !== undefined && val > maxInclusive) return null;
  return val;
}

export function validateBoolean(body: unknown, key: string): boolean | null {
  const val = bodyField(body, key);
  return typeof val === "boolean" ? val : null;
}

export function preconditionFailed(reason: string) {
  return { error: { type: "PRECONDITION_FAILED" as const, reason } } as const;
}

type ShopActionOk = ShopStateRow | { state: ShopStateRow; finalBoard: (BoardUnit | null)[] };

function isWithBoard(
  v: ShopActionOk,
): v is { state: ShopStateRow; finalBoard: (BoardUnit | null)[] } {
  return "finalBoard" in v;
}

type ShopActionErr = { type: string; [key: string]: unknown };

type AfterPersist = (db: DrizzleD1Database, playerId: string, state: ShopStateRow) => void;

async function persistShopState(
  c: Context,
  db: DrizzleD1Database,
  playerId: string,
  run: RunInfo,
  shopRow: { id: string; version: number },
  value: ShopActionOk,
  afterPersist?: AfterPersist,
) {
  const newState = isWithBoard(value) ? value.state : value;
  const lifeChanged = newState.life !== run.life ? newState.life : undefined;
  const saveResult = await saveShopState(
    db,
    shopRow.id,
    shopRow.version,
    newState,
    lifeChanged,
    lifeChanged !== undefined ? run.id : undefined,
  );
  if (saveResult.isErr()) {
    const e = saveResult.error;
    if (e.type === "CONFLICT")
      return c.json({ error: { type: "CONFLICT", reason: e.reason } }, 409);
    return internalError(c, "[shop:save]", e);
  }

  if (isWithBoard(value)) {
    const snapError = await saveBoardSnapshot(db, playerId, run.id, run.night, value.finalBoard, {
      life: newState.life,
      trophy: run.trophy,
    });
    if (snapError) return internalError(c, "[shop:snapshot]", snapError);
  }

  afterPersist?.(db, playerId, newState);

  return c.json({ shop: toResponse(newState, run.trophy) });
}

async function saveBoardSnapshot(
  db: DrizzleD1Database,
  playerId: string,
  runId: string,
  night: number,
  finalBoard: (BoardUnit | null)[],
  stats: { life: number; trophy: number },
) {
  const boardUnits = finalBoard.filter((u): u is BoardUnit => u !== null);
  const now = new Date();
  const result = await safeAsync(
    () =>
      db
        .insert(boardSnapshots)
        .values({
          id: generateId(),
          playerId,
          runId,
          night,
          board: boardUnits,
          life: stats.life,
          trophy: stats.trophy,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [boardSnapshots.runId, boardSnapshots.night],
          set: { board: boardUnits, life: stats.life, trophy: stats.trophy, createdAt: now },
        }),
    dbErr,
  );
  return result.isErr() ? result.error : null;
}

async function runShopAction(
  c: Context,
  db: DrizzleD1Database,
  playerId: string,
  runId: string,
  handler: (state: ShopStateRow, run: RunInfo) => Result<ShopActionOk, ShopActionErr>,
  afterPersist?: AfterPersist,
) {
  const loaded = await loadShopState(db, playerId, runId);
  if (loaded.type === "error") return internalError(c, loaded.label, loaded.error);
  if (loaded.type === "not_found")
    return c.json({ error: { type: "NOT_FOUND", entity: loaded.entity } }, 404);

  const { run, shopRow, state } = loaded;
  const result = handler(state, run);
  if (result.isErr()) return c.json({ error: result.error }, 400);

  return persistShopState(c, db, playerId, run, shopRow, result.value, afterPersist);
}

function parseContext(c: Context) {
  const db = c.get("db");
  const playerId = c.get("playerId") as string;
  const body = getParsedBody(c);
  const runId = validateRunId(body);
  return { db, playerId, body, runId };
}

export function shopAction(
  c: Context,
  handler: (state: ShopStateRow, run: RunInfo) => Result<ShopActionOk, ShopActionErr>,
  afterPersist?: AfterPersist,
) {
  const { db, playerId, runId } = parseContext(c);
  if (!runId) return c.json(preconditionFailed("invalid_run_id"), 400);
  return runShopAction(c, db, playerId, runId, handler, afterPersist);
}

interface HandlerArgs<T> {
  state: ShopStateRow;
  run: RunInfo;
  extra: T;
}

export function shopActionWithParsed<T>(
  c: Context,
  parseExtra: (body: unknown) => T | null,
  handler: (args: HandlerArgs<T>) => Result<ShopActionOk, ShopActionErr>,
  parseError?: string,
) {
  const { db, playerId, body, runId } = parseContext(c);
  if (!runId) return c.json(preconditionFailed("invalid_run_id"), 400);
  const extra = parseExtra(body);
  if (extra === null) return c.json(preconditionFailed(parseError ?? "invalid_params"), 400);
  return runShopAction(c, db, playerId, runId, (state, run) => handler({ state, run, extra }));
}
