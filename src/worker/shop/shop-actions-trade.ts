import { ok, err } from "../../shared/errors";
import type { Result, GameError } from "../../shared/errors";
import type { UnitInstance, ShopSlot, OriginId } from "../../shared/types";
import type { ShopSlotJson } from "../../db/shop-state-types";
import { UNIT_COST } from "../../shared/constants";
import { sellBloodGain, type Buff } from "../../shared/skill-params";
import {
  applyBuyEffects,
  applyChaliceEffect,
  applySellEffects,
  applyBoneTreeBuyEffects,
  buffRandomUnit,
} from "../../engine/shop-effects";
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
import type { Rng } from "../../engine/rng";
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
  const buyResult = applyBuyEffects(unit, newBoard, state.rotRingUses, rng);
  const throneBoard = applyBoneTreeBuyEffects(buyResult.board);
  const rewards = generateLevelUpRewards(leveledUp, state.night, rng);

  let shopUnits = opts.shopUnits ?? state.shopUnits;
  if (buyResult.shopBuff) shopUnits = applyShopBuffToRandom(shopUnits, buyResult.shopBuff, rng);

  return ok({
    ...state,
    blood: state.blood - cost,
    board: instancesToBoard(throneBoard),
    shopUnits,
    shopItems: buyResult.chaliceTriggered
      ? itemSlotsToJson(applyChaliceEffect(itemSlotsFromJson(state.shopItems)))
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

function applyShopBuffToRandom(
  shopSlots: ShopStateRow["shopUnits"],
  buff: Buff,
  rng: Rng,
): ShopStateRow["shopUnits"] {
  const parsed = slotsFromJson(shopSlots);
  const active = parsed.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
  if (active.length === 0) return shopSlots;
  const idx = active[Math.floor(rng.next() * active.length)]!;
  const target = parsed[idx]!;
  parsed[idx] = {
    ...target,
    unit: {
      ...target.unit,
      buffAtk: target.unit.buffAtk + buff.atk,
      buffHp: target.unit.buffHp + buff.hp,
    },
  };
  return slotsToJson(parsed);
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

  if (originId === "surgeon") {
    buffRandomUnit(newBoard, 1, 1, rng);
    return ok({
      ...state,
      blood: state.blood + bloodGain,
      board: instancesToBoard(newBoard),
      shopUnits,
      undoSnapshot: captureUndo(state),
      ...saveRng(),
    });
  }

  return ok({
    ...state,
    blood: state.blood + bloodGain,
    board: instancesToBoard(newBoard),
    shopUnits,
    undoSnapshot: captureUndo(state),
    ...saveRng(),
  });
}
