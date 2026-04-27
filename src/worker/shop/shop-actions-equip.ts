import { err, ok } from "../../shared/errors";
import type { GameError, Result } from "../../shared/errors";
import type { ItemData, UnitInstance } from "../../shared/types";
import { shuffleAndTakeN } from "../../engine/helpers";
import { applyShopBuffToSlots } from "../../engine/shop-buff";
import { applyCatItemMultiplier, calcAlchemyDiscount } from "../../engine/shop-effects";
import { applyCorpseBrokerDoseBuff, applyPlagueBellDoseBuff } from "../../engine/shop-effects-dose";
import { isAlchemy, itemHasMultipliableStats, itemNeedsBoardTarget } from "../../shared/data/items";
import type { ShopStateRow } from "./shop-state-row";
import { boardToInstances, instancesToBoard, singleItemSlotFromJson } from "./shop-serialization";
import { captureUndo, withRng } from "./shop-helpers";

interface DoseApplied {
  board: (UnitInstance | null)[];
  corpseBrokerUses: number;
  rngS0: number;
  rngS1: number;
}

interface EquipApplied {
  board: (UnitInstance | null)[];
  shopUnits: ShopStateRow["shopUnits"];
  appliedBoardIndex: number;
  shopBuffAtk: number;
  shopBuffHp: number;
}

function pickDistinctBoardTargets(
  board: (UnitInstance | null)[],
  rng: ReturnType<typeof withRng>["rng"],
  count: number,
): number[] {
  const picks = board
    .map((unit, index) => (unit ? index : null))
    .filter((index): index is number => index !== null);
  return shuffleAndTakeN(picks, count, rng);
}

function applyAlchemyDoseEffects(
  state: ShopStateRow,
  board: (UnitInstance | null)[],
  boardIndex: number,
  isAlchemyItem: boolean,
): DoseApplied {
  if (!isAlchemyItem) {
    return {
      board,
      corpseBrokerUses: state.corpseBrokerUses,
      rngS0: state.rngS0,
      rngS1: state.rngS1,
    };
  }
  const dose = applyCorpseBrokerDoseBuff(board, boardIndex, state.corpseBrokerUses);
  const { rng, saveRng } = withRng(state);
  const boardAfterPlague = applyPlagueBellDoseBuff(dose.board, boardIndex, rng);
  const rngState = saveRng();
  return {
    board: boardAfterPlague,
    corpseBrokerUses: dose.corpseBrokerUses,
    rngS0: rngState.rngS0,
    rngS1: rngState.rngS1,
  };
}

function getShopItem(state: ShopStateRow, shopItemIndex: number): Result<ItemData, GameError> {
  if (shopItemIndex >= state.shopItems.length) {
    return err({ type: "INVALID_INDEX", index: shopItemIndex });
  }
  const itemSlotJson = state.shopItems[shopItemIndex];
  if (!itemSlotJson) return err({ type: "INVALID_TARGET", reason: "empty_item_slot" });
  const itemSlot = singleItemSlotFromJson(itemSlotJson);
  return ok(itemSlot.item);
}

function ensureBlood(state: ShopStateRow, effectiveCost: number): Result<null, GameError> {
  if (state.blood >= effectiveCost) return ok(null);
  return err({
    type: "INSUFFICIENT_RESOURCE",
    resource: "blood",
    minimum: effectiveCost,
    current: state.blood,
  });
}

function applySingleTargetStats(
  board: (UnitInstance | null)[],
  boardIndex: number,
  atk: number,
  hp: number,
): void {
  const unit = board[boardIndex]!;
  board[boardIndex] = {
    ...unit,
    baseAtk: unit.baseAtk + atk,
    baseHp: unit.baseHp + hp,
  };
}

function applySingleTargetEquip(
  board: (UnitInstance | null)[],
  boardIndex: number,
  atk: number,
  hp: number,
  equip: UnitInstance["equip"],
): void {
  const unit = board[boardIndex]!;
  board[boardIndex] = {
    ...unit,
    baseAtk: unit.baseAtk + atk,
    baseHp: unit.baseHp + hp,
    equip,
  };
}

function baseEquipApplied(
  state: ShopStateRow,
  board: (UnitInstance | null)[],
  appliedBoardIndex: number,
): EquipApplied {
  return {
    board,
    shopUnits: state.shopUnits,
    appliedBoardIndex,
    shopBuffAtk: 0,
    shopBuffHp: 0,
  };
}

function applyRandomTeamStats(
  state: ShopStateRow,
  board: (UnitInstance | null)[],
  count: number,
  atk: number,
  hp: number,
  rng: ReturnType<typeof withRng>["rng"],
): Result<EquipApplied, GameError> {
  const targetIndices = pickDistinctBoardTargets(board, rng, count);
  if (targetIndices.length === 0) return err({ type: "INVALID_TARGET", reason: "no_target" });
  for (const index of targetIndices) {
    applySingleTargetStats(board, index, atk, hp);
  }
  return ok(baseEquipApplied(state, board, targetIndices[0]!));
}

function applyItemEffect(
  state: ShopStateRow,
  board: (UnitInstance | null)[],
  item: ItemData,
  boardIndex: number,
  atk: number,
  hp: number,
  rng: ReturnType<typeof withRng>["rng"],
): Result<EquipApplied, GameError> {
  switch (item.effect.kind) {
    case "single_target_stat":
      applySingleTargetStats(board, boardIndex, atk, hp);
      return ok(baseEquipApplied(state, board, boardIndex));
    case "single_target_equip":
      applySingleTargetEquip(board, boardIndex, item.effect.atk, item.effect.hp, item.effect.equip);
      return ok(baseEquipApplied(state, board, boardIndex));
    case "random_team_stat":
      return applyRandomTeamStats(state, board, item.effect.count, atk, hp, rng);
    case "shop_current_and_future_stat":
      return ok({
        board,
        shopUnits: applyShopBuffToSlots(state.shopUnits, { atk, hp }),
        appliedBoardIndex: boardIndex,
        shopBuffAtk: atk,
        shopBuffHp: hp,
      });
  }
}

function getEffectiveCost(state: ShopStateRow, item: ItemData): number {
  return Math.max(0, item.cost - (isAlchemy(item) ? calcAlchemyDiscount(state.board) : 0));
}

function getCatAdjustedStats(
  state: ShopStateRow,
  board: (UnitInstance | null)[],
  item: ItemData,
): { atk: number; hp: number; nextUses: number } {
  return itemHasMultipliableStats(item)
    ? applyCatItemMultiplier(board, item.atk, item.hp, state.boneTreeUses)
    : { atk: item.atk, hp: item.hp, nextUses: state.boneTreeUses };
}

function resolveAppliedDose(
  state: ShopStateRow,
  effect: EquipApplied,
  requiresTarget: boolean,
  item: ItemData,
  rngState: { rngS0: number; rngS1: number },
): DoseApplied {
  const applied = applyAlchemyDoseEffects(
    state,
    effect.board,
    effect.appliedBoardIndex,
    isAlchemy(item) && requiresTarget,
  );
  if (!isAlchemy(item) || !requiresTarget) {
    applied.rngS0 = rngState.rngS0;
    applied.rngS1 = rngState.rngS1;
  }
  return applied;
}

function finishEquip(
  state: ShopStateRow,
  shopItemIndex: number,
  effectiveCost: number,
  applied: DoseApplied,
  effect: EquipApplied,
  nextBoneTreeUses: number,
): ShopStateRow {
  return {
    ...state,
    blood: state.blood - effectiveCost,
    board: instancesToBoard(applied.board),
    shopUnits: effect.shopUnits,
    shopItems: state.shopItems.map((slot, index) => (index === shopItemIndex ? null : slot)),
    shopBuffAtk: state.shopBuffAtk + effect.shopBuffAtk,
    shopBuffHp: state.shopBuffHp + effect.shopBuffHp,
    corpseBrokerUses: applied.corpseBrokerUses,
    boneTreeUses: nextBoneTreeUses,
    rngS0: applied.rngS0,
    rngS1: applied.rngS1,
    undoSnapshot: captureUndo(state),
  };
}

export function executeEquip(
  state: ShopStateRow,
  shopItemIndex: number,
  boardIndex: number,
): Result<ShopStateRow, GameError> {
  const itemResult = getShopItem(state, shopItemIndex);
  if (itemResult.isErr()) return err(itemResult.error);
  const item = itemResult.value;

  const effectiveCost = getEffectiveCost(state, item);
  const bloodCheck = ensureBlood(state, effectiveCost);
  if (bloodCheck.isErr()) return err(bloodCheck.error);

  const board = boardToInstances(state.board);
  const requiresTarget = itemNeedsBoardTarget(item);
  if (requiresTarget && !board[boardIndex]) {
    return err({ type: "INVALID_TARGET", reason: "no_target" });
  }

  const catResult = getCatAdjustedStats(state, board, item);
  const { rng, saveRng } = withRng(state);
  const effectResult = applyItemEffect(
    state,
    [...board],
    item,
    boardIndex,
    catResult.atk,
    catResult.hp,
    rng,
  );
  if (effectResult.isErr()) return err(effectResult.error);

  const applied = resolveAppliedDose(state, effectResult.value, requiresTarget, item, saveRng());
  return ok(
    finishEquip(
      state,
      shopItemIndex,
      effectiveCost,
      applied,
      effectResult.value,
      catResult.nextUses,
    ),
  );
}
