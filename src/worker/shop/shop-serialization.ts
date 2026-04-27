import type { UnitInstance, ShopSlot, ShopItemSlot } from "../../shared/types";
import type { BoardUnit } from "../../shared/board-unit";
import { unitInstanceToBoardUnit, boardUnitToUnitInstance } from "../../shared/board-unit";
import { ITEMS } from "../../shared/data/items";
import { invariant } from "../../shared/invariant";
import type { ShopSlotJson, ShopItemSlotJson } from "../../db/shop-state-types";

function slotToJson(slot: ShopSlot): ShopSlotJson {
  return {
    unit: unitInstanceToBoardUnit(slot.unit),
    frozen: slot.frozen,
    ...(slot.costOverride !== undefined ? { costOverride: slot.costOverride } : {}),
    eventSourced: slot.eventSourced,
  };
}

export function slotFromJson(json: ShopSlotJson): ShopSlot {
  return {
    unit: boardUnitToUnitInstance(json.unit),
    frozen: json.frozen,
    ...(json.costOverride !== undefined ? { costOverride: json.costOverride } : {}),
    eventSourced: json.eventSourced,
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

export function singleItemSlotFromJson(json: ShopItemSlotJson): ShopItemSlot {
  return itemSlotFromJson(json);
}

export function boardToInstances(b: (BoardUnit | null)[]): (UnitInstance | null)[] {
  return b.map((bu) => (bu ? boardUnitToUnitInstance(bu) : null));
}

export function instancesToBoard(b: (UnitInstance | null)[]): (BoardUnit | null)[] {
  return b.map((u) => (u ? unitInstanceToBoardUnit(u) : null));
}

export function slotsToJson(slots: (ShopSlot | null)[]): (ShopSlotJson | null)[] {
  return slots.map((s) => (s ? slotToJson(s) : null));
}

export function itemSlotsToJson(slots: (ShopItemSlot | null)[]): (ShopItemSlotJson | null)[] {
  return slots.map((s) => (s ? itemSlotToJson(s) : null));
}

export function slotsFromJson(json: (ShopSlotJson | null)[]): (ShopSlot | null)[] {
  return json.map((s) => (s ? slotFromJson(s) : null));
}

export function itemSlotsFromJson(json: (ShopItemSlotJson | null)[]): (ShopItemSlot | null)[] {
  return json.map((s) => (s ? itemSlotFromJson(s) : null));
}
