import type { UnitInstance, ItemData, Selection, HighlightKind, SoundResult } from "../types";
import type { ShopStateResponse } from "../../shared/api-types";
import type { Result, InfraError } from "../../shared/errors";
import { NO_SOUND, SE_SELECT, SE_ERROR } from "../sound-results";
import {
  blood,
  board,
  shopUnits,
  selection,
  onboardingStep,
  shopLocked,
  currentRunId,
  flashResourceError,
  passiveGraftIds,
} from "./game-store";
import { runShopAction } from "./shop-actions";
import {
  buyUnit as apiBuyUnit,
  buyReward as apiBuyReward,
  equipItem as apiEquipItem,
  swapBoard as apiSwapBoard,
} from "../api/shop-client";
import { UNIT_COST } from "../../shared/constants";

function getSlotCost(index: number): number {
  return shopUnits.value[index]?.costOverride ?? UNIT_COST;
}

function rejectWithResourceError(resource: "blood" | "life"): SoundResult {
  selection.value = null;
  flashResourceError(resource);
  return SE_ERROR;
}

function rejectInvalidAction(): SoundResult {
  selection.value = null;
  return SE_ERROR;
}

function buyUnitToSlot(
  sel: { type: "SHOP_UNIT" | "REWARD_UNIT"; index: number; item: UnitInstance },
  targetUnit: UnitInstance | null,
  cost: number,
  makeApiCall: () => Promise<Result<ShopStateResponse, InfraError>>,
  label: string,
): SoundResult {
  if (blood.value < cost) return rejectWithResourceError("blood");
  const canPlace = !targetUnit;
  const canGraft = targetUnit !== null && targetUnit.id === sel.item.id && targetUnit.level < 3;
  if (!canPlace && !canGraft) return rejectInvalidAction();

  if (shopLocked.value) return NO_SOUND;

  const isGraft = !!targetUnit;
  const unitId = sel.item.id;
  return runShopAction(label, makeApiCall(), () => {
    if (sel.type === "SHOP_UNIT" && !isGraft && onboardingStep.value === "buy") {
      const hasSame = board.value.filter((u) => u && u.id === unitId).length > 1;
      const shopHasSame = shopUnits.value.some((s) => s && s.unit.id === unitId);
      onboardingStep.value = hasSame || shopHasSame ? "graft" : "roll";
    }
    if (isGraft && onboardingStep.value === "graft") onboardingStep.value = "roll";
    return isGraft ? "graft" : "buy";
  });
}

function handleShopItemToSlot(
  sel: Extract<Selection, { type: "SHOP_ITEM" }>,
  index: number,
  targetUnit: UnitInstance | null,
): SoundResult {
  if (!targetUnit) return rejectInvalidAction();
  if (blood.value < sel.item.cost) return rejectWithResourceError("blood");

  if (shopLocked.value) return NO_SOUND;
  const runId = currentRunId.value;
  if (!runId) return NO_SOUND;

  return runShopAction("[equip]", apiEquipItem(runId, sel.index, index), () => "graft");
}

function handleBoardUnitToSlot(
  sel: Extract<Selection, { type: "BOARD_UNIT" }>,
  index: number,
): SoundResult {
  if (shopLocked.value) return NO_SOUND;
  const runId = currentRunId.value;
  if (!runId) return NO_SOUND;

  const targetUnit = board.value[index] ?? null;
  const isGraft =
    !!targetUnit && targetUnit.id === sel.item.id && targetUnit.level < 3 && sel.index !== index;
  return runShopAction("[swap]", apiSwapBoard(runId, sel.index, index), () => {
    if (isGraft && onboardingStep.value === "graft") onboardingStep.value = "roll";
    return isGraft ? "graft" : "buy";
  });
}

function handleBoardSlotClick(sel: Selection | null, index: number): SoundResult {
  if (index < 0 || index > 4) return NO_SOUND;
  const targetUnit = board.value[index] ?? null;
  if (!sel) {
    if (targetUnit) {
      selection.value = { type: "BOARD_UNIT", index, item: targetUnit };
      return SE_SELECT;
    }
    return NO_SOUND;
  }
  return dispatchSlotAction(sel, index, targetUnit);
}

function dispatchSlotAction(
  sel: Selection,
  index: number,
  targetUnit: UnitInstance | null,
): SoundResult {
  const runId = currentRunId.value;
  if (!runId) return NO_SOUND;
  if (sel.type === "SHOP_UNIT") {
    return buyUnitToSlot(
      sel,
      targetUnit,
      getSlotCost(sel.index),
      () => apiBuyUnit(runId, sel.index, index),
      "[buy]",
    );
  }
  if (sel.type === "SHOP_ITEM") {
    return handleShopItemToSlot(sel, index, targetUnit);
  }
  if (sel.type === "REWARD_UNIT") {
    return buyUnitToSlot(
      sel,
      targetUnit,
      UNIT_COST,
      () => apiBuyReward(runId, sel.index, index),
      "[buy-reward]",
    );
  }
  if (sel.type === "BOARD_UNIT") {
    return handleBoardUnitToSlot(sel, index);
  }
  return NO_SOUND;
}

function trySelectShopCard(
  type: Selection["type"],
  index: number,
  item: UnitInstance | ItemData | null,
): SoundResult {
  if ((type === "SHOP_UNIT" || type === "REWARD_UNIT") && item && "uid" in item) {
    selection.value = { type, index, item };
    return SE_SELECT;
  }
  if (type === "SHOP_ITEM" && item && "cost" in item && !("uid" in item)) {
    selection.value = { type, index, item };
    return SE_SELECT;
  }
  return NO_SOUND;
}

export function handleCardClick(
  type: Selection["type"] | "BOARD_SLOT",
  index: number,
  item: UnitInstance | ItemData | null,
): SoundResult {
  const sel = selection.value;
  if (sel && sel.type === type && sel.index === index) {
    selection.value = null;
    return SE_SELECT;
  }
  if (type === "BOARD_SLOT") {
    return handleBoardSlotClick(sel, index);
  }
  return trySelectShopCard(type, index, item);
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

function canHighlightForReward(
  sel: Extract<Selection, { type: "REWARD_UNIT" }>,
  unit: UnitInstance | null,
): HighlightKind {
  if (blood.value < UNIT_COST) return false;
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
  return "swap";
}

export function checkHighlight(
  targetType: string,
  index: number,
  unit: UnitInstance | null,
): HighlightKind {
  if (targetType === "BOARD_SLOT") {
    const sel = selection.value;
    if (sel) {
      if (sel.type === "SHOP_ITEM") return canHighlightForItem(sel, unit);
      if (sel.type === "SHOP_UNIT") return canHighlightForUnit(sel, unit);
      if (sel.type === "REWARD_UNIT") return canHighlightForReward(sel, unit);
      if (sel.type === "BOARD_UNIT") return canHighlightForBoardUnit(sel, index, unit);
      return false;
    }
  }

  if (unit && passiveGraftIds.value.has(unit.id)) return "passive-graft";
  return false;
}
