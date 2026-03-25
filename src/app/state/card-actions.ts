import { batch } from "@preact/signals";
import type { UnitInstance, ItemData, Selection } from "../types";
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

type BuyUnitAction =
  | { action: "place"; board: (UnitInstance | null)[] }
  | { action: "graft"; board: (UnitInstance | null)[] };

function validateBuyUnit(
  sel: Extract<Selection, { type: "SHOP_UNIT" }>,
  index: number,
  targetUnit: UnitInstance | null,
  currentBlood: number,
  currentBoard: (UnitInstance | null)[],
): Result<BuyUnitAction, GameError> {
  if (currentBlood < UNIT_COST)
    return err({
      type: "INSUFFICIENT_RESOURCE",
      resource: "blood",
      required: UNIT_COST,
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
    equip: sel.item.equip || target.equip,
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

function handleShopUnitToSlot(
  sel: Extract<Selection, { type: "SHOP_UNIT" }>,
  index: number,
  targetUnit: UnitInstance | null,
) {
  validateBuyUnit(sel, index, targetUnit, blood.value, board.value).match(
    ({ action, board: newBoard }) =>
      batch(() => {
        captureSnapshot();
        playSE(action === "graft" ? "graft" : "buy");
        blood.value -= UNIT_COST;
        finalizeShopUnitPurchase(sel, newBoard);
        if (action === "place" && onboardingStep.value === "buy") {
          const hasSame = newBoard.filter((u) => u && u.id === sel.item.id).length > 1;
          const shopHasSame = shopUnits.value.some((s) => s && s.unit.id === sel.item.id);
          onboardingStep.value = hasSame || shopHasSame ? "graft" : "roll";
        }
        if (action === "graft" && onboardingStep.value === "graft") onboardingStep.value = "roll";
      }),
    rejectAction,
  );
}

function handleShopItemToSlot(
  sel: Extract<Selection, { type: "SHOP_ITEM" }>,
  index: number,
  targetUnit: UnitInstance | null,
) {
  validateEquipItem(sel, index, targetUnit, blood.value, board.value).match(
    ({ board: newBoard }) =>
      batch(() => {
        captureSnapshot();
        playSE("graft");
        blood.value -= sel.item.cost;
        board.value = newBoard;
        shopItems.value = shopItems.value.map((u, i) => (i === sel.index ? null : u));
        selection.value = null;
      }),
    rejectAction,
  );
}

function handleBoardUnitToSlot(sel: Extract<Selection, { type: "BOARD_UNIT" }>, index: number) {
  captureSnapshot();
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
): boolean {
  return blood.value >= sel.item.cost && !!unit;
}

function canHighlightForUnit(
  sel: Extract<Selection, { type: "SHOP_UNIT" }>,
  unit: UnitInstance | null,
): boolean {
  if (blood.value < UNIT_COST) return false;
  return !unit || (unit.id === sel.item.id && unit.level < 3);
}

function canHighlightForBoardUnit(
  sel: Extract<Selection, { type: "BOARD_UNIT" }>,
  index: number,
  unit: UnitInstance | null,
): boolean {
  return sel.index !== index && (!unit || (unit.id === sel.item.id && unit.level < 3));
}

export function checkHighlight(
  targetType: string,
  index: number,
  unit: UnitInstance | null,
): boolean {
  if (targetType !== "BOARD_SLOT") return false;
  const sel = selection.value;
  if (!sel) return false;
  if (sel.type === "SHOP_ITEM") return canHighlightForItem(sel, unit);
  if (sel.type === "SHOP_UNIT") return canHighlightForUnit(sel, unit);
  if (sel.type === "BOARD_UNIT") return canHighlightForBoardUnit(sel, index, unit);
  return false;
}
