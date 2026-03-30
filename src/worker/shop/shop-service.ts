import { ok, err } from "../../shared/errors";
import type { Result, GameError } from "../../shared/errors";
import { invariant } from "../../shared/invariant";
import type { UnitInstance, ShopSlot, ShopItemSlot, EventData, OriginId } from "../../shared/types";
import type { BoardUnit } from "../../shared/board-unit";
import { unitInstanceToBoardUnit, boardUnitToUnitInstance } from "../../shared/board-unit";
import { ITEMS } from "../../shared/data/items";
import type { StatefulRng } from "../../engine/rng";
import { createSeededRng, restoreRng } from "../../engine/rng";
import {
  createUnit,
  getShopPool,
  getItemPool,
  getUnitsByTier,
  pickRandom,
} from "../../engine/helpers";
import {
  isEventRound,
  selectEvent,
  buildEventShopUnits,
  buildEventShopItems,
} from "../../engine/event-helpers";
import {
  graftUnits,
  applyBuyEffects,
  applyChaliceEffect,
  applySummonEffects,
  applyEndOfTurnEffects,
} from "../../engine/shop-effects";
import { UNIT_COST } from "../../shared/constants";
import {
  SHOP_SIZES,
  SHOP_SIZE_DEFAULT,
  ITEM_SHOP_SIZES,
  ITEM_SHOP_SIZE_DEFAULT,
} from "../../engine/constants";
import type { ShopSlotJson, ShopItemSlotJson, ShopUndoSnapshot } from "../../db/shop-state-types";

export type ShopStateRow = ShopUndoSnapshot & {
  undoSnapshot: ShopUndoSnapshot | null;
  round: number;
};

type ShopStateNonUndoFields = "undoSnapshot" | "round";
type _AssertUndoCoverage =
  Exclude<keyof ShopStateRow, keyof ShopUndoSnapshot | ShopStateNonUndoFields> extends never
    ? true
    : "ShopStateRow has fields not in ShopUndoSnapshot or ShopStateNonUndoFields";
const _undoCoverageCheck: _AssertUndoCoverage = true;
void _undoCoverageCheck;

function slotToJson(slot: ShopSlot): ShopSlotJson {
  return {
    unit: unitInstanceToBoardUnit(slot.unit),
    frozen: slot.frozen,
    ...(slot.costOverride !== undefined ? { costOverride: slot.costOverride } : {}),
  };
}

function slotFromJson(json: ShopSlotJson): ShopSlot {
  return {
    unit: boardUnitToUnitInstance(json.unit),
    frozen: json.frozen,
    ...(json.costOverride !== undefined ? { costOverride: json.costOverride } : {}),
  };
}

function itemSlotToJson(slot: ShopItemSlot): ShopItemSlotJson {
  return { itemId: slot.item.id, frozen: slot.frozen };
}

function itemSlotFromJson(json: ShopItemSlotJson): ShopItemSlot {
  const item = ITEMS[json.itemId as keyof typeof ITEMS];
  invariant(item != null, `unknown itemId: ${json.itemId}`);
  return { item, frozen: json.frozen };
}

function boardToInstances(b: (BoardUnit | null)[]): (UnitInstance | null)[] {
  return b.map((bu) => (bu ? boardUnitToUnitInstance(bu) : null));
}

function instancesToBoard(b: (UnitInstance | null)[]): (BoardUnit | null)[] {
  return b.map((u) => (u ? unitInstanceToBoardUnit(u) : null));
}

function slotsToJson(slots: (ShopSlot | null)[]): (ShopSlotJson | null)[] {
  return slots.map((s) => (s ? slotToJson(s) : null));
}

function itemSlotsToJson(slots: (ShopItemSlot | null)[]): (ShopItemSlotJson | null)[] {
  return slots.map((s) => (s ? itemSlotToJson(s) : null));
}

function slotsFromJson(json: (ShopSlotJson | null)[]): (ShopSlot | null)[] {
  return json.map((s) => (s ? slotFromJson(s) : null));
}

function itemSlotsFromJson(json: (ShopItemSlotJson | null)[]): (ShopItemSlot | null)[] {
  return json.map((s) => (s ? itemSlotFromJson(s) : null));
}

function captureUndo(state: ShopStateRow): ShopUndoSnapshot {
  return {
    blood: state.blood,
    board: state.board,
    shopUnits: state.shopUnits,
    shopItems: state.shopItems,
    freeRoll: state.freeRoll,
    cultistUsed: state.cultistUsed,
    rotRingUses: state.rotRingUses,
    activeEvent: state.activeEvent,
    rngS0: state.rngS0,
    rngS1: state.rngS1,
    sanity: state.sanity,
  };
}

function withRng(state: ShopStateRow): {
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

function getShopSize(r: number): number {
  for (const { minRound, size } of SHOP_SIZES) {
    if (r >= minRound) return size;
  }
  return SHOP_SIZE_DEFAULT;
}

function generateShopUnits(
  r: number,
  prev: (ShopSlot | null)[],
  sizeModifier: number,
  rng: StatefulRng,
): (ShopSlot | null)[] {
  const pool = getShopPool(r);
  const size = Math.max(0, getShopSize(r) + sizeModifier);
  return [...Array(size).keys()].map((i) => {
    if (prev[i]?.frozen) return prev[i];
    return { unit: createUnit(pickRandom(pool, rng)), frozen: false };
  });
}

function applyInquisitorUpgrade(
  units: (ShopSlot | null)[],
  currentOrigin: OriginId | null,
  rng: StatefulRng,
): (ShopSlot | null)[] {
  if (currentOrigin !== "inquisitor") return units;
  const candidates = units
    .map((s, i) => (s && !s.frozen && s.unit.tier < 6 ? i : -1))
    .filter((i) => i >= 0);
  if (candidates.length === 0) return units;
  const targetIdx = pickRandom(candidates, rng);
  const slot = units[targetIdx];
  if (!slot) return units;
  const higherTier = getUnitsByTier(slot.unit.tier + 1);
  if (higherTier.length === 0) return units;
  const newId = pickRandom([...higherTier], rng);
  const next = [...units];
  next[targetIdx] = { unit: createUnit(newId), frozen: slot.frozen };
  return next;
}

function generateShopItems(
  r: number,
  prev: (ShopItemSlot | null)[],
  rng: StatefulRng,
): (ShopItemSlot | null)[] {
  const itemPool = getItemPool();
  const size = r >= ITEM_SHOP_SIZES[0].minRound ? ITEM_SHOP_SIZES[0].size : ITEM_SHOP_SIZE_DEFAULT;
  return [...Array(size).keys()].map((i) => {
    const existing = prev[i];
    if (existing?.frozen) return existing;
    const item = ITEMS[pickRandom(itemPool, rng)];
    return { item, frozen: false };
  });
}

function buildShopForRound(
  currentRound: number,
  event: EventData | null,
  currentOrigin: OriginId | null,
  prevUnits: (ShopSlot | null)[],
  prevItems: (ShopItemSlot | null)[],
  rng: StatefulRng,
): { units: (ShopSlot | null)[]; items: (ShopItemSlot | null)[] } {
  let units: (ShopSlot | null)[];
  if (event?.replacesShopUnits) {
    units = buildEventShopUnits(event, currentRound, rng);
  } else {
    const sizeModifier = event?.shopSizeModifier ?? 0;
    units = generateShopUnits(currentRound, prevUnits, sizeModifier, rng);
    units = applyInquisitorUpgrade(units, currentOrigin, rng);
  }

  if (event?.shopUnitBuff) {
    const buff = event.shopUnitBuff;
    units = units.map((slot) =>
      slot && !slot.frozen
        ? {
            ...slot,
            unit: { ...slot.unit, atk: slot.unit.atk + buff.atk, hp: slot.unit.hp + buff.hp },
          }
        : slot,
    );
  }

  const items =
    event && event.itemOffers.length > 0
      ? buildEventShopItems(event, rng)
      : generateShopItems(currentRound, prevItems, rng);

  return { units, items };
}

function deriveRoundSeed(shopSeed: number, round: number): number {
  invariant(round >= 1, `deriveRoundSeed: round must be >= 1, got ${round}`);
  const mixed = (shopSeed ^ Math.imul(round, 0x9e3779b9)) | 0;
  return mixed === 0 ? 1 : mixed;
}

export function executeSetup(
  round: number,
  sanity: number,
  originId: OriginId | null,
  shopSeed: number,
  prevBoard: (BoardUnit | null)[],
  useTutorialShop: boolean,
): ShopStateRow {
  const roundSeed = deriveRoundSeed(shopSeed, round);
  const rng = createSeededRng(roundSeed);

  const event = !useTutorialShop && isEventRound(round) ? selectEvent(rng) : null;

  let shopSlots: (ShopSlot | null)[];
  let shopItemSlots: (ShopItemSlot | null)[];

  if (useTutorialShop) {
    shopSlots = applyInquisitorUpgrade(
      [
        { unit: createUnit("rat"), frozen: false },
        { unit: createUnit("rat"), frozen: false },
        { unit: createUnit("bat"), frozen: false },
      ],
      originId,
      rng,
    );
    shopItemSlots = generateShopItems(round, [], rng);
  } else {
    const result = buildShopForRound(round, event, originId, [], [], rng);
    shopSlots = result.units;
    shopItemSlots = result.items;
  }

  const rngState = rng.getState();

  return {
    blood: 10 + (event?.bloodBonus ?? 0),
    board: prevBoard,
    shopUnits: slotsToJson(shopSlots),
    shopItems: itemSlotsToJson(shopItemSlots),
    freeRoll: (event?.freeRoll ?? false) || originId === "thief",
    cultistUsed: false,
    rotRingUses: 0,
    activeEvent: event,
    rngS0: rngState.s0,
    rngS1: rngState.s1,
    undoSnapshot: null,
    round,
    sanity,
  };
}

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
      required: 1,
      current: state.blood,
    });

  const { rng, saveRng } = withRng(state);
  const prevUnits = slotsFromJson(state.shopUnits);
  const prevItems = itemSlotsFromJson(state.shopItems);
  const { units, items } = buildShopForRound(
    state.round,
    state.activeEvent,
    originId,
    prevUnits,
    prevItems,
    rng,
  );

  return ok({
    ...state,
    blood: state.freeRoll ? state.blood : state.blood - 1,
    freeRoll: false,
    shopUnits: slotsToJson(units),
    shopItems: itemSlotsToJson(items),
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
      required: cost,
      current: state.blood,
    });

  const instances = boardToInstances(state.board);
  const targetUnit = instances[boardIndex] ?? null;

  let newBoard: (UnitInstance | null)[];
  if (!targetUnit) {
    const placed = [...instances];
    placed[boardIndex] = slot.unit;
    newBoard = applySummonEffects(boardIndex, placed);
  } else if (targetUnit.id === slot.unit.id && targetUnit.level < 3) {
    const grafted = [...instances];
    grafted[boardIndex] = graftUnits(targetUnit, slot.unit);
    newBoard = grafted;
  } else {
    return err({ type: "INVALID_TARGET", reason: "incompatible_unit" });
  }

  const buyResult = applyBuyEffects(slot.unit, newBoard, state.rotRingUses);

  const newShopUnits = state.shopUnits.map((u, i) => (i === shopIndex ? null : u));

  let newShopItems = state.shopItems;
  if (buyResult.chaliceTriggered) {
    const itemSlots = itemSlotsFromJson(state.shopItems);
    newShopItems = itemSlotsToJson(applyChaliceEffect(itemSlots));
  }

  return ok({
    ...state,
    blood: state.blood - cost,
    board: instancesToBoard(buyResult.board),
    shopUnits: newShopUnits,
    shopItems: newShopItems,
    rotRingUses: buyResult.rotRingUses,
    undoSnapshot: captureUndo(state),
  });
}

export function executeSell(
  state: ShopStateRow,
  boardIndex: number,
  originId: OriginId | null,
): Result<ShopStateRow, GameError> {
  const instances = boardToInstances(state.board);
  const unit = instances[boardIndex];
  if (!unit) return err({ type: "INVALID_TARGET", reason: "slot_empty" });

  const bloodGain = unit.id === "beggar" ? 2 : 1;
  const newBoard = [...instances];
  newBoard[boardIndex] = null;

  if (originId === "surgeon") {
    const { rng, saveRng } = withRng(state);
    const active = newBoard.map((u, i) => (u ? i : null)).filter((i): i is number => i !== null);
    if (active.length > 0) {
      const targetIdx = active[Math.floor(rng.next() * active.length)];
      if (targetIdx !== undefined) {
        const target = newBoard[targetIdx];
        if (target) {
          newBoard[targetIdx] = { ...target, atk: target.atk + 1, hp: target.hp + 1 };
        }
      }
    }
    return ok({
      ...state,
      blood: state.blood + bloodGain,
      board: instancesToBoard(newBoard),
      undoSnapshot: captureUndo(state),
      ...saveRng(),
    });
  }

  return ok({
    ...state,
    blood: state.blood + bloodGain,
    board: instancesToBoard(newBoard),
    undoSnapshot: captureUndo(state),
  });
}

export function executeEquip(
  state: ShopStateRow,
  shopItemIndex: number,
  boardIndex: number,
): Result<ShopStateRow, GameError> {
  if (shopItemIndex >= state.shopItems.length)
    return err({ type: "INVALID_INDEX", index: shopItemIndex });
  const itemSlotJson = state.shopItems[shopItemIndex];
  if (!itemSlotJson) return err({ type: "INVALID_TARGET", reason: "empty_item_slot" });

  const itemSlot = itemSlotFromJson(itemSlotJson);
  const item = itemSlot.item;

  if (state.blood < item.cost)
    return err({
      type: "INSUFFICIENT_RESOURCE",
      resource: "blood",
      required: item.cost,
      current: state.blood,
    });

  const instances = boardToInstances(state.board);
  const target = instances[boardIndex];
  if (!target) return err({ type: "INVALID_TARGET", reason: "no_target" });

  const newBoard = [...instances];
  newBoard[boardIndex] = {
    ...target,
    atk: target.atk + item.atk,
    hp: target.hp + item.hp,
    equip: item.equip ?? target.equip,
  };

  const newShopItems = state.shopItems.map((u, i) => (i === shopItemIndex ? null : u));

  return ok({
    ...state,
    blood: state.blood - item.cost,
    board: instancesToBoard(newBoard),
    shopItems: newShopItems,
    undoSnapshot: captureUndo(state),
  });
}

export function executeFreeze(
  state: ShopStateRow,
  isUnit: boolean,
  index: number,
  frozen: boolean,
): Result<ShopStateRow, GameError> {
  if (isUnit) {
    if (index >= state.shopUnits.length) return err({ type: "INVALID_INDEX", index });
    const slot = state.shopUnits[index];
    if (!slot) return err({ type: "INVALID_TARGET", reason: "empty_shop_slot" });
    if (slot.frozen === frozen) return ok(state);
    const newShopUnits = [...state.shopUnits];
    newShopUnits[index] = { ...slot, frozen };
    return ok({ ...state, shopUnits: newShopUnits });
  }
  if (index >= state.shopItems.length) return err({ type: "INVALID_INDEX", index });
  const slot = state.shopItems[index];
  if (!slot) return err({ type: "INVALID_TARGET", reason: "empty_item_slot" });
  if (slot.frozen === frozen) return ok(state);
  const newShopItems = [...state.shopItems];
  newShopItems[index] = { ...slot, frozen };
  return ok({ ...state, shopItems: newShopItems });
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
    newBoard[toIndex] = graftUnits(toUnit, fromUnit);
    newBoard[fromIndex] = null;
  } else {
    newBoard[fromIndex] = toUnit;
    newBoard[toIndex] = fromUnit;
  }

  return ok({
    ...state,
    board: instancesToBoard(newBoard),
  });
}

export function executeCultist(
  state: ShopStateRow,
  originId: OriginId | null,
): Result<ShopStateRow, GameError> {
  if (originId !== "cultist") return err({ type: "PRECONDITION_FAILED", reason: "not_cultist" });
  if (state.cultistUsed) return err({ type: "PRECONDITION_FAILED", reason: "already_used" });
  if (state.sanity < 1)
    return err({
      type: "INSUFFICIENT_RESOURCE",
      resource: "sanity",
      required: 1,
      current: state.sanity,
    });

  return ok({
    ...state,
    sanity: state.sanity - 1,
    blood: state.blood + 3,
    cultistUsed: true,
    undoSnapshot: captureUndo(state),
  });
}

export function executeDismissEvent(
  state: ShopStateRow,
  originId: OriginId | null,
): Result<ShopStateRow, GameError> {
  if (!state.activeEvent) return err({ type: "PRECONDITION_FAILED", reason: "no_active_event" });

  const event = state.activeEvent;
  const { rng, saveRng } = withRng(state);
  const prevItems = itemSlotsFromJson(state.shopItems);
  // prevUnits=[] : イベント解除時はショップユニットを全再生成する（frozen枠も残さない）
  const { units, items } = buildShopForRound(state.round, null, originId, [], prevItems, rng);

  const bloodBeforeEvent = state.blood - event.bloodBonus;

  return ok({
    ...state,
    blood: Math.max(0, bloodBeforeEvent),
    activeEvent: null,
    freeRoll: originId === "thief",
    shopUnits: slotsToJson(units),
    shopItems: itemSlotsToJson(items),
    undoSnapshot: captureUndo(state),
    ...saveRng(),
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
    sanity: snap.sanity,
    undoSnapshot: null,
  });
}

export function executeReady(
  state: ShopStateRow,
): Result<{ state: ShopStateRow; finalBoard: (BoardUnit | null)[] }, GameError> {
  const instances = boardToInstances(state.board);
  if (!instances.some((u) => u !== null))
    return err({ type: "PRECONDITION_FAILED", reason: "board_empty" });

  const finalInstances = applyEndOfTurnEffects(instances);
  const finalBoard = instancesToBoard(finalInstances);

  return ok({
    state: { ...state, board: finalBoard, undoSnapshot: null },
    finalBoard,
  });
}
