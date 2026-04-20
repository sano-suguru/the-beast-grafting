import { ITEMS } from "../shared/data/items";
import type { UnitInstance, ItemData } from "../shared/types";
import type { Rng } from "./rng";
import { atLevel, BONE_JAW, ROT_FEEDER, CORPSE_PECKER } from "../shared/skill-params";
import { buffRandomUnit } from "./buff-utils";

interface SellResult {
  board: (UnitInstance | null)[];
  shopBuff?: { atk: number; hp: number } | undefined;
  stockItems?: ItemData[] | undefined;
}

// ── Self-sell triggers (fired by the sold unit's own ability) ──

function applyBoneJawSelfSell(
  soldUnit: UnitInstance,
  board: (UnitInstance | null)[],
  rng: Rng,
): void {
  if (soldUnit.id !== "bone_jaw") return;
  const atkBuff = atLevel(BONE_JAW.atkBuff, soldUnit.level);
  for (let t = 0; t < BONE_JAW.targets; t++) {
    buffRandomUnit(board, atkBuff, 0, rng);
  }
}

function getRotFeederSelfSellBuff(soldUnit: UnitInstance): { atk: number; hp: number } | undefined {
  if (soldUnit.id !== "rot_feeder") return undefined;
  const hp = atLevel(ROT_FEEDER.hpBuff, soldUnit.level);
  return hp > 0 ? { atk: 0, hp } : undefined;
}

function getCorpsePeckerSelfSellItems(soldUnit: UnitInstance): ItemData[] | undefined {
  if (soldUnit.id !== "corpse_pecker") return undefined;
  const count = atLevel(CORPSE_PECKER.breadCrumbs, soldUnit.level);
  const boneMeal = ITEMS.bone_meal;
  const items: ItemData[] = [];
  for (let i = 0; i < count; i++) items.push(boneMeal);
  return items.length > 0 ? items : undefined;
}

export const applySellEffects = (
  soldUnit: UnitInstance,
  currentBoard: (UnitInstance | null)[],
  rng: Rng,
): SellResult => {
  const nextBoard = [...currentBoard];
  applyBoneJawSelfSell(soldUnit, nextBoard, rng);
  const selfShopBuff = getRotFeederSelfSellBuff(soldUnit);
  const stockItems = getCorpsePeckerSelfSellItems(soldUnit);
  return {
    board: nextBoard,
    shopBuff: selfShopBuff,
    stockItems,
  };
};
