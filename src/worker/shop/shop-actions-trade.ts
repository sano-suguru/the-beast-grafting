import { ok, err } from "../../shared/errors";
import type { Result, GameError } from "../../shared/errors";
import type { UnitInstance, ShopSlot, ShopItemSlot, OriginId, ItemData } from "../../shared/types";
import type { ShopSlotJson } from "../../db/shop-state-types";
import { UNIT_COST } from "../../shared/constants";
import { sellBloodGain, type Buff } from "../../shared/skill-params";
import {
  applyBuyEffects,
  applyChaliceEffect,
  applyLevelUpEffects,
  applySellEffects,
} from "../../engine/shop-effects";
import { buffRandomUnit } from "../../engine/buff-utils";
import type { ShopStateRow } from "./shop-state-row";
import {
  slotFromJson,
  boardToInstances,
  instancesToBoard,
  slotsToJson,
  slotsFromJson,
  itemSlotsToJson,
  itemSlotsFromJson,
} from "./shop-serialization";
import { buildShopForNight, generateLevelUpRewards } from "./shop-generation";
import { captureUndo, placeUnitOnBoard, withRng } from "./shop-helpers";

export function executeRoll(
  state: ShopStateRow,
  originId: OriginId | null,
): Result<ShopStateRow, GameError> {
  if (state.activeEvent?.lockRoll)
    return err({ type: "PRECONDITION_FAILED", reason: "roll_locked" });
  if (!state.freeRoll && state.blood < 1)
    return err({
      type: "INSUFFICIENT_RESOURCE",
      resource: "blood",
      minimum: 1,
      current: state.blood,
    });

  const { rng, saveRng } = withRng(state);
  const allPrev = slotsFromJson(state.shopUnits);
  const normalPrev = allPrev.map((s) => (s?.eventSourced ? null : s));
  const frozenEventSlots = allPrev.filter((s): s is ShopSlot => !!s?.eventSourced && s.frozen);
  const prevItems = itemSlotsFromJson(state.shopItems);
  const { units, items } = buildShopForNight(
    state.night,
    state.activeEvent,
    originId,
    normalPrev,
    prevItems,
    rng,
  );
  const finalUnits: (ShopSlot | null)[] = [...units, ...frozenEventSlots];

  return ok({
    ...state,
    blood: state.freeRoll ? state.blood : state.blood - 1,
    freeRoll: false,
    shopUnits: slotsToJson(finalUnits),
    shopItems: itemSlotsToJson(items),
    rewardSlots: state.rewardSlots.filter((s) => s?.frozen),
    ...saveRng(),
  });
}

export function executeBuy(
  state: ShopStateRow,
  shopIndex: number,
  boardIndex: number,
): Result<ShopStateRow, GameError> {
  if (shopIndex >= state.shopUnits.length) return err({ type: "INVALID_INDEX", index: shopIndex });
  const slotJson = state.shopUnits[shopIndex];
  if (!slotJson) return err({ type: "INVALID_TARGET", reason: "empty_shop_slot" });

  const slot = slotFromJson(slotJson);
  const cost = slot.costOverride ?? UNIT_COST;
  if (state.blood < cost)
    return err({
      type: "INSUFFICIENT_RESOURCE",
      resource: "blood",
      minimum: cost,
      current: state.blood,
    });

  return finalizeBuy(state, slot.unit, boardIndex, cost, {
    shopUnits: state.shopUnits.map((u, i) => (i === shopIndex ? null : u)),
    rewardMode: "append",
  });
}

export function executeBuyReward(
  state: ShopStateRow,
  rewardIndex: number,
  boardIndex: number,
): Result<ShopStateRow, GameError> {
  if (rewardIndex >= state.rewardSlots.length)
    return err({ type: "INVALID_INDEX", index: rewardIndex });
  const slotJson = state.rewardSlots[rewardIndex];
  if (!slotJson) return err({ type: "INVALID_TARGET", reason: "empty_reward_slot" });

  if (state.blood < UNIT_COST)
    return err({
      type: "INSUFFICIENT_RESOURCE",
      resource: "blood",
      minimum: UNIT_COST,
      current: state.blood,
    });

  return finalizeBuy(state, slotFromJson(slotJson).unit, boardIndex, UNIT_COST, {
    rewardMode: "replace",
  });
}

function finalizeBuy(
  state: ShopStateRow,
  unit: UnitInstance,
  boardIndex: number,
  cost: number,
  opts: { shopUnits?: (ShopSlotJson | null)[]; rewardMode: "append" | "replace" },
): Result<ShopStateRow, GameError> {
  const placeResult = placeUnitOnBoard(unit, boardToInstances(state.board), boardIndex);
  if (placeResult.isErr()) return err(placeResult.error);
  const { board: newBoard, leveledUp } = placeResult.value;

  const { rng, saveRng } = withRng(state);
  if (leveledUp) applyLevelUpEffects(newBoard, boardIndex, rng);
  const buyResult = applyBuyEffects(unit, newBoard, state.rotRingUses, rng, boardIndex);
  const rewards = generateLevelUpRewards(leveledUp, state.night, rng);

  const shopUnits = opts.shopUnits ?? state.shopUnits;

  return ok({
    ...state,
    blood: state.blood - cost,
    board: instancesToBoard(buyResult.board),
    shopUnits,
    shopItems:
      buyResult.chaliceLevel !== null
        ? itemSlotsToJson(
            applyChaliceEffect(itemSlotsFromJson(state.shopItems), buyResult.chaliceLevel),
          )
        : state.shopItems,
    rewardSlots: opts.rewardMode === "append" ? [...state.rewardSlots, ...rewards] : rewards,
    rotRingUses: buyResult.rotRingUses,
    undoSnapshot: captureUndo(state),
    ...saveRng(),
  });
}

function applyShopBuffAll(
  shopSlots: ShopStateRow["shopUnits"],
  buff: Buff,
): ShopStateRow["shopUnits"] {
  return slotsToJson(
    slotsFromJson(shopSlots).map((s) =>
      s
        ? {
            ...s,
            unit: {
              ...s.unit,
              buffAtk: s.unit.buffAtk + buff.atk,
              buffHp: s.unit.buffHp + buff.hp,
            },
          }
        : null,
    ),
  );
}

function stockItemsToShop(
  slots: (ShopItemSlot | null)[],
  items: ItemData[],
): (ShopItemSlot | null)[] {
  const result = [...slots];
  let placed = 0;
  for (let i = 0; i < result.length && placed < items.length; i++) {
    if (result[i] === null) {
      result[i] = { item: items[placed]!, frozen: false };
      placed++;
    }
  }
  return result;
}

export function executeSell(
  state: ShopStateRow,
  boardIndex: number,
  originId: OriginId | null,
): Result<ShopStateRow, GameError> {
  const instances = boardToInstances(state.board);
  const unit = instances[boardIndex];
  if (!unit) return err({ type: "INVALID_TARGET", reason: "slot_empty" });

  const bloodGain = sellBloodGain(unit.level, unit.id);
  let newBoard: (UnitInstance | null)[] = [...instances];
  newBoard[boardIndex] = null;

  const { rng, saveRng } = withRng(state);
  const sellResult = applySellEffects(unit, newBoard, rng);
  newBoard = sellResult.board;
  const shopUnits = sellResult.shopBuff
    ? applyShopBuffAll(state.shopUnits, sellResult.shopBuff)
    : state.shopUnits;
  const shopItems = sellResult.stockItems
    ? itemSlotsToJson(stockItemsToShop(itemSlotsFromJson(state.shopItems), sellResult.stockItems))
    : state.shopItems;

  if (originId === "surgeon") {
    buffRandomUnit(newBoard, 1, 1, rng);
    return ok({
      ...state,
      blood: state.blood + bloodGain,
      board: instancesToBoard(newBoard),
      shopUnits,
      shopItems,
      undoSnapshot: captureUndo(state),
      ...saveRng(),
    });
  }

  return ok({
    ...state,
    blood: state.blood + bloodGain,
    board: instancesToBoard(newBoard),
    shopUnits,
    shopItems,
    undoSnapshot: captureUndo(state),
    ...saveRng(),
  });
}
