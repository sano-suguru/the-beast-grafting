import type { UnitInstance, ItemData, Selection, HighlightKind } from "../types";
import type { ShopStateResponse } from "../../shared/api-types";
import type { Result, InfraError } from "../../shared/errors";
import { initAudio, playSE } from "../engine/audio";
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
import { markSeen } from "./lore";
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

function rejectWithResourceError(resource: "blood" | "sanity") {
  selection.value = null;
  playSE("error");
  flashResourceError(resource);
}

function rejectInvalidAction() {
  selection.value = null;
  playSE("error");
}

function buyUnitToSlot(
  sel: { type: "SHOP_UNIT" | "REWARD_UNIT"; index: number; item: UnitInstance },
  targetUnit: UnitInstance | null,
  cost: number,
  makeApiCall: () => Promise<Result<ShopStateResponse, InfraError>>,
  label: string,
) {
  if (blood.value < cost) return rejectWithResourceError("blood");
  const canPlace = !targetUnit;
  const canGraft = targetUnit !== null && targetUnit.id === sel.item.id && targetUnit.level < 3;
  if (!canPlace && !canGraft) return rejectInvalidAction();

  if (shopLocked.value) return;

  const isGraft = !!targetUnit;
  const unitId = sel.item.id;
  void runShopAction(label, makeApiCall(), () => {
    playSE(isGraft ? "graft" : "buy");
    if (sel.type === "SHOP_UNIT" && !isGraft && onboardingStep.value === "buy") {
      const hasSame = board.value.filter((u) => u && u.id === unitId).length > 1;
      const shopHasSame = shopUnits.value.some((s) => s && s.unit.id === unitId);
      onboardingStep.value = hasSame || shopHasSame ? "graft" : "roll";
    }
    if (isGraft && onboardingStep.value === "graft") onboardingStep.value = "roll";
    markSeen(board.value.filter((u): u is UnitInstance => u !== null).map((u) => u.id));
  });
}

function handleShopItemToSlot(
  sel: Extract<Selection, { type: "SHOP_ITEM" }>,
  index: number,
  targetUnit: UnitInstance | null,
) {
  if (!targetUnit) return rejectInvalidAction();
  if (blood.value < sel.item.cost) return rejectWithResourceError("blood");

  if (shopLocked.value) return;
  const runId = currentRunId.value;
  if (!runId) return;

  void runShopAction("[equip]", apiEquipItem(runId, sel.index, index), () => {
    playSE("graft");
  });
}

function handleBoardUnitToSlot(sel: Extract<Selection, { type: "BOARD_UNIT" }>, index: number) {
  if (shopLocked.value) return;
  const runId = currentRunId.value;
  if (!runId) return;

  const targetUnit = board.value[index] ?? null;
  const isGraft =
    !!targetUnit && targetUnit.id === sel.item.id && targetUnit.level < 3 && sel.index !== index;
  void runShopAction("[swap]", apiSwapBoard(runId, sel.index, index), () => {
    playSE(isGraft ? "graft" : "buy");
    if (isGraft && onboardingStep.value === "graft") onboardingStep.value = "roll";
  });
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
  const runId = currentRunId.value;
  if (!runId) return;
  if (sel.type === "SHOP_UNIT") {
    buyUnitToSlot(
      sel,
      targetUnit,
      getSlotCost(sel.index),
      () => apiBuyUnit(runId, sel.index, index),
      "[buy]",
    );
    return;
  }
  if (sel.type === "SHOP_ITEM") {
    handleShopItemToSlot(sel, index, targetUnit);
    return;
  }
  if (sel.type === "REWARD_UNIT") {
    buyUnitToSlot(
      sel,
      targetUnit,
      UNIT_COST,
      () => apiBuyReward(runId, sel.index, index),
      "[buy-reward]",
    );
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
  if ((type === "SHOP_UNIT" || type === "REWARD_UNIT") && item && "uid" in item) {
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

function canHighlightForReward(unit: UnitInstance | null): HighlightKind {
  if (blood.value < UNIT_COST) return false;
  if (!unit) return "move";
  const sel = selection.value;
  if (!sel || sel.type !== "REWARD_UNIT") return false;
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
      if (sel.type === "REWARD_UNIT") return canHighlightForReward(unit);
      if (sel.type === "BOARD_UNIT") return canHighlightForBoardUnit(sel, index, unit);
      return false;
    }
  }

  if (unit && passiveGraftIds.value.has(unit.id)) return "passive-graft";
  return false;
}
