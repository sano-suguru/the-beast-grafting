import { ok, err } from "../../shared/errors";
import type { Result, GameError } from "../../shared/errors";
import type { OriginId } from "../../shared/types";
import type { BoardUnit } from "../../shared/board-unit";
import { graftUnits } from "../../engine/shop-effects";
import { CULTIST_LIFE_COST, CULTIST_BLOOD_GAIN } from "../../shared/constants";
import type { ShopStateRow } from "./shop-state-row";
import { boardToInstances, instancesToBoard, itemSlotsFromJson } from "./shop-serialization";
import { captureUndo, withRng } from "./shop-helpers";
import { generateLevelUpRewards } from "./shop-generation";

export function executeEquip(
  state: ShopStateRow,
  shopItemIndex: number,
  boardIndex: number,
): Result<ShopStateRow, GameError> {
  if (shopItemIndex >= state.shopItems.length)
    return err({ type: "INVALID_INDEX", index: shopItemIndex });
  const itemSlotJson = state.shopItems[shopItemIndex];
  if (!itemSlotJson) return err({ type: "INVALID_TARGET", reason: "empty_item_slot" });

  const itemSlot = itemSlotsFromJson([itemSlotJson])[0];
  if (!itemSlot) return err({ type: "INVALID_TARGET", reason: "empty_item_slot" });
  const item = itemSlot.item;

  if (state.blood < item.cost)
    return err({
      type: "INSUFFICIENT_RESOURCE",
      resource: "blood",
      minimum: item.cost,
      current: state.blood,
    });

  const instances = boardToInstances(state.board);
  const target = instances[boardIndex];
  if (!target) return err({ type: "INVALID_TARGET", reason: "no_target" });

  const newBoard = [...instances];
  newBoard[boardIndex] = {
    ...target,
    baseAtk: target.baseAtk + item.atk,
    baseHp: target.baseHp + item.hp,
    equip: item.equip ?? target.equip,
  };

  return ok({
    ...state,
    blood: state.blood - item.cost,
    board: instancesToBoard(newBoard),
    shopItems: state.shopItems.map((u, i) => (i === shopItemIndex ? null : u)),
    undoSnapshot: captureUndo(state),
  });
}

function freezeSlot<T extends { frozen: boolean }>(
  slots: (T | null)[],
  index: number,
  frozen: boolean,
  emptyReason: string,
): Result<(T | null)[], GameError> {
  if (index >= slots.length) return err({ type: "INVALID_INDEX", index });
  const slot = slots[index];
  if (!slot) return err({ type: "INVALID_TARGET", reason: emptyReason });
  if (slot.frozen === frozen) return ok(slots);
  const updated = [...slots];
  updated[index] = { ...slot, frozen };
  return ok(updated);
}

function applyFreezeResult<K extends keyof ShopStateRow>(
  state: ShopStateRow,
  original: unknown[],
  result: Result<unknown[], GameError>,
  key: K,
): Result<ShopStateRow, GameError> {
  if (result.isErr()) return err(result.error);
  if (result.value === original) return ok(state);
  return ok({ ...state, [key]: result.value });
}

export function executeFreeze(
  state: ShopStateRow,
  slotType: "unit" | "item" | "reward",
  index: number,
  frozen: boolean,
): Result<ShopStateRow, GameError> {
  if (slotType === "unit") {
    return applyFreezeResult(
      state,
      state.shopUnits,
      freezeSlot(state.shopUnits, index, frozen, "empty_shop_slot"),
      "shopUnits",
    );
  }
  if (slotType === "reward") {
    return applyFreezeResult(
      state,
      state.rewardSlots,
      freezeSlot(state.rewardSlots, index, frozen, "empty_reward_slot"),
      "rewardSlots",
    );
  }
  return applyFreezeResult(
    state,
    state.shopItems,
    freezeSlot(state.shopItems, index, frozen, "empty_item_slot"),
    "shopItems",
  );
}

export function executeSwap(
  state: ShopStateRow,
  fromIndex: number,
  toIndex: number,
): Result<ShopStateRow, GameError> {
  if (fromIndex === toIndex) return ok(state);

  const instances = boardToInstances(state.board);
  const fromUnit = instances[fromIndex];
  if (!fromUnit) return err({ type: "INVALID_TARGET", reason: "slot_empty" });

  const toUnit = instances[toIndex] ?? null;
  const newBoard = [...instances];

  if (toUnit && toUnit.id === fromUnit.id && toUnit.level < 3) {
    const graft = graftUnits(toUnit, fromUnit);
    newBoard[toIndex] = graft.unit;
    newBoard[fromIndex] = null;

    if (graft.leveledUp) {
      const { rng, saveRng } = withRng(state);
      const rewards = generateLevelUpRewards(true, state.night, rng);
      return ok({
        ...state,
        board: instancesToBoard(newBoard),
        rewardSlots: [...state.rewardSlots, ...rewards],
        ...saveRng(),
      });
    }
  } else {
    newBoard[fromIndex] = toUnit;
    newBoard[toIndex] = fromUnit;
  }

  return ok({ ...state, board: instancesToBoard(newBoard) });
}

export function executeCultist(
  state: ShopStateRow,
  originId: OriginId | null,
): Result<ShopStateRow, GameError> {
  if (originId !== "cultist") return err({ type: "PRECONDITION_FAILED", reason: "not_cultist" });
  if (state.cultistUsed) return err({ type: "PRECONDITION_FAILED", reason: "already_used" });
  if (state.life - CULTIST_LIFE_COST < 1)
    return err({
      type: "INSUFFICIENT_RESOURCE",
      resource: "life",
      minimum: CULTIST_LIFE_COST + 1,
      current: state.life,
    });

  return ok({
    ...state,
    life: state.life - CULTIST_LIFE_COST,
    blood: state.blood + CULTIST_BLOOD_GAIN,
    cultistUsed: true,
    undoSnapshot: captureUndo(state),
  });
}

export function executeUndo(state: ShopStateRow): Result<ShopStateRow, GameError> {
  if (!state.undoSnapshot) return err({ type: "PRECONDITION_FAILED", reason: "no_undo_available" });

  const snap = state.undoSnapshot;
  return ok({
    ...state,
    blood: snap.blood,
    board: snap.board,
    shopUnits: snap.shopUnits,
    shopItems: snap.shopItems,
    freeRoll: snap.freeRoll,
    cultistUsed: snap.cultistUsed,
    rotRingUses: snap.rotRingUses,
    activeEvent: snap.activeEvent,
    rngS0: snap.rngS0,
    rngS1: snap.rngS1,
    life: snap.life,
    rewardSlots: snap.rewardSlots,
    undoSnapshot: null,
  });
}

export function executeReady(
  state: ShopStateRow,
): Result<{ state: ShopStateRow; finalBoard: (BoardUnit | null)[] }, GameError> {
  const instances = boardToInstances(state.board);
  if (!instances.some((u) => u !== null))
    return err({ type: "PRECONDITION_FAILED", reason: "board_empty" });

  const finalBoard = instancesToBoard(instances);

  return ok({
    state: { ...state, board: finalBoard, undoSnapshot: null },
    finalBoard,
  });
}
