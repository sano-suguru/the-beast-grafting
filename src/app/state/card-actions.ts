import { batch } from "@preact/signals";
import type { UnitInstance, ItemData, Selection, HighlightKind } from "../types";
import { initAudio, playSE } from "../engine/audio";
import {
  graftUnits,
  applyBuyEffects,
  applyChaliceEffect,
  applySummonEffects,
} from "../engine/shop-effects";
import {
  blood,
  board,
  shopUnits,
  shopItems,
  selection,
  onboardingStep,
  rotRingUses,
} from "./game-store";
import { ok, err } from "../../shared/errors";
import type { Result, GameError } from "../../shared/errors";
import { captureSnapshot } from "./undo-actions";
import { UNIT_COST } from "../engine/constants";

function getSlotCost(index: number): number {
  return shopUnits.value[index]?.costOverride ?? UNIT_COST;
}

type BuyUnitAction =
  | { action: "place"; board: (UnitInstance | null)[] }
  | { action: "graft"; board: (UnitInstance | null)[] };

function validateBuyUnit(
  sel: Extract<Selection, { type: "SHOP_UNIT" }>,
  index: number,
  targetUnit: UnitInstance | null,
  currentBlood: number,
  currentBoard: (UnitInstance | null)[],
  cost: number = UNIT_COST,
): Result<BuyUnitAction, GameError> {
  if (currentBlood < cost)
    return err({
      type: "INSUFFICIENT_RESOURCE",
      resource: "blood",
      required: cost,
      current: currentBlood,
    });
  if (!targetUnit) {
    const newBoard = [...currentBoard];
    newBoard[index] = sel.item;
    return ok({ action: "place", board: applySummonEffects(index, newBoard) });
  }
  if (targetUnit.id === sel.item.id && targetUnit.level < 3) {
    const newBoard = [...currentBoard];
    const target = newBoard[index];
    if (!target) return err({ type: "INVALID_TARGET", reason: "slot_empty" });
    newBoard[index] = graftUnits(target, sel.item);
    return ok({ action: "graft", board: newBoard });
  }
  return err({ type: "INVALID_TARGET", reason: "incompatible_unit" });
}

interface EquipItemAction {
  board: (UnitInstance | null)[];
}

function validateEquipItem(
  sel: Extract<Selection, { type: "SHOP_ITEM" }>,
  index: number,
  targetUnit: UnitInstance | null,
  currentBlood: number,
  currentBoard: (UnitInstance | null)[],
): Result<EquipItemAction, GameError> {
  if (!targetUnit) return err({ type: "INVALID_TARGET", reason: "no_target" });
  if (currentBlood < sel.item.cost)
    return err({
      type: "INSUFFICIENT_RESOURCE",
      resource: "blood",
      required: sel.item.cost,
      current: currentBlood,
    });
  const target = currentBoard[index];
  if (!target) return err({ type: "INVALID_TARGET", reason: "slot_empty" });
  const newBoard = [...currentBoard];
  newBoard[index] = {
    ...target,
    atk: target.atk + sel.item.atk,
    hp: target.hp + sel.item.hp,
    equip: sel.item.equip ?? target.equip,
  };
  return ok({ board: newBoard });
}

function finalizeShopUnitPurchase(
  sel: Extract<Selection, { type: "SHOP_UNIT" }>,
  newBoard: (UnitInstance | null)[],
) {
  const buyResult = applyBuyEffects(sel.item, newBoard, rotRingUses.value);
  board.value = buyResult.board;
  rotRingUses.value = buyResult.rotRingUses;
  shopUnits.value = shopUnits.value.map((u, i) => (i === sel.index ? null : u));
  selection.value = null;
  if (buyResult.chaliceTriggered) {
    shopItems.value = applyChaliceEffect(shopItems.value);
  }
  return buyResult;
}

function rejectAction() {
  selection.value = null;
  playSE("error");
}

function advanceOnboarding(action: "place" | "graft", unitId: string) {
  if (action === "place" && onboardingStep.value === "buy") {
    const hasSame = board.value.filter((u) => u && u.id === unitId).length > 1;
    const shopHasSame = shopUnits.value.some((s) => s && s.unit.id === unitId);
    onboardingStep.value = hasSame || shopHasSame ? "graft" : "roll";
  }
  if (action === "graft" && onboardingStep.value === "graft") onboardingStep.value = "roll";
}

function handleShopUnitToSlot(
  sel: Extract<Selection, { type: "SHOP_UNIT" }>,
  index: number,
  targetUnit: UnitInstance | null,
) {
  const cost = getSlotCost(sel.index);
  const result = validateBuyUnit(sel, index, targetUnit, blood.value, board.value, cost);
  if (result.isErr()) return rejectAction();
  const { action, board: newBoard } = result.value;
  captureSnapshot();
  playSE(action === "graft" ? "graft" : "buy");
  batch(() => {
    blood.value -= cost;
    finalizeShopUnitPurchase(sel, newBoard);
    advanceOnboarding(action, sel.item.id);
  });
}

function handleShopItemToSlot(
  sel: Extract<Selection, { type: "SHOP_ITEM" }>,
  index: number,
  targetUnit: UnitInstance | null,
) {
  validateEquipItem(sel, index, targetUnit, blood.value, board.value).match(
    ({ board: newBoard }) => {
      captureSnapshot();
      playSE("graft");
      batch(() => {
        blood.value -= sel.item.cost;
        board.value = newBoard;
        shopItems.value = shopItems.value.map((u, i) => (i === sel.index ? null : u));
        selection.value = null;
      });
    },
    rejectAction,
  );
}

function handleBoardUnitToSlot(sel: Extract<Selection, { type: "BOARD_UNIT" }>, index: number) {
  const newBoard = [...board.value];
  const tUnit = newBoard[index] ?? null;
  if (tUnit && tUnit.id === sel.item.id && tUnit.level < 3 && sel.index !== index) {
    playSE("graft");
    newBoard[index] = graftUnits(tUnit, sel.item);
    newBoard[sel.index] = null;
    if (onboardingStep.value === "graft") onboardingStep.value = "roll";
  } else {
    playSE("buy");
    newBoard[sel.index] = tUnit ?? null;
    newBoard[index] = sel.item;
  }
  board.value = newBoard;
  selection.value = null;
}

function handleBoardSlotClick(sel: Selection | null, index: number) {
  if (index < 0 || index > 4) return;
  const targetUnit = board.value[index] ?? null;
  if (!sel) {
    if (targetUnit) {
      playSE("select");
      selection.value = { type: "BOARD_UNIT", index, item: targetUnit };
    }
    return;
  }
  dispatchSlotAction(sel, index, targetUnit);
}

function dispatchSlotAction(sel: Selection, index: number, targetUnit: UnitInstance | null) {
  if (sel.type === "SHOP_UNIT") {
    handleShopUnitToSlot(sel, index, targetUnit);
    return;
  }
  if (sel.type === "SHOP_ITEM") {
    handleShopItemToSlot(sel, index, targetUnit);
    return;
  }
  if (sel.type === "BOARD_UNIT") {
    handleBoardUnitToSlot(sel, index);
  }
}

function trySelectShopCard(
  type: Selection["type"],
  index: number,
  item: UnitInstance | ItemData | null,
) {
  if (type === "SHOP_UNIT" && item && "uid" in item) {
    playSE("select");
    selection.value = { type, index, item };
    return;
  }
  if (type === "SHOP_ITEM" && item && "cost" in item && !("uid" in item)) {
    playSE("select");
    selection.value = { type, index, item };
  }
}

export function handleCardClick(
  type: Selection["type"] | "BOARD_SLOT",
  index: number,
  item: UnitInstance | ItemData | null,
) {
  initAudio();
  const sel = selection.value;
  if (sel && sel.type === type && sel.index === index) {
    playSE("select");
    selection.value = null;
    return;
  }
  if (type === "BOARD_SLOT") {
    handleBoardSlotClick(sel, index);
    return;
  }
  trySelectShopCard(type, index, item);
}

function canHighlightForItem(
  sel: Extract<Selection, { type: "SHOP_ITEM" }>,
  unit: UnitInstance | null,
): HighlightKind {
  return blood.value >= sel.item.cost && !!unit ? "graft" : false;
}

function canHighlightForUnit(
  sel: Extract<Selection, { type: "SHOP_UNIT" }>,
  unit: UnitInstance | null,
): HighlightKind {
  const cost = getSlotCost(sel.index);
  if (blood.value < cost) return false;
  if (!unit) return "move";
  if (unit.id === sel.item.id && unit.level < 3) return "graft";
  return false;
}

function canHighlightForBoardUnit(
  sel: Extract<Selection, { type: "BOARD_UNIT" }>,
  index: number,
  unit: UnitInstance | null,
): HighlightKind {
  if (sel.index === index) return false;
  if (!unit) return "move";
  if (unit.id === sel.item.id && unit.level < 3) return "graft";
  return "swap"; // 全占有スロットはswap可能 — 視覚は最も控えめ
}

export function checkHighlight(
  targetType: string,
  index: number,
  unit: UnitInstance | null,
): HighlightKind {
  if (targetType !== "BOARD_SLOT") return false;
  const sel = selection.value;
  if (!sel) return false;
  if (sel.type === "SHOP_ITEM") return canHighlightForItem(sel, unit);
  if (sel.type === "SHOP_UNIT") return canHighlightForUnit(sel, unit);
  if (sel.type === "BOARD_UNIT") return canHighlightForBoardUnit(sel, index, unit);
  return false;
}
