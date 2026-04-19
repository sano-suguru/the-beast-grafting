import { ITEMS } from "../shared/data/items";
import type { UnitInstance, ItemData } from "../shared/types";
import type { Rng } from "./rng";
import { effectiveAtk, effectiveHp } from "../shared/unit-stats";
import {
  atLevel,
  MARKET_VULTURE,
  ASH_FUNGUS,
  CORPSE_BROKER,
  BONE_JAW,
  ROT_FEEDER,
  CORPSE_PECKER,
} from "../shared/skill-params";
import { buffRandomUnit, sumBuffByUnitId } from "./buff-utils";

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

// ── Passive sell reactions (remaining board units react to any sell) ──

function collectPassiveShopBuff(
  board: (UnitInstance | null)[],
): { atk: number; hp: number } | undefined {
  const { atk, hp } = sumBuffByUnitId(board, "market_vulture", MARKET_VULTURE.shopBuff);
  return atk > 0 || hp > 0 ? { atk, hp } : undefined;
}

function applyAshFungusSell(soldUnit: UnitInstance, nextBoard: (UnitInstance | null)[], rng: Rng) {
  const totalStats = effectiveAtk(soldUnit) + effectiveHp(soldUnit);
  for (let i = 0; i < nextBoard.length; i++) {
    const u = nextBoard[i];
    if (!u || u.id !== "ash_fungus") continue;
    const buff = Math.floor(totalStats * (atLevel(ASH_FUNGUS.percent, u.level) / 100));
    if (buff <= 0) continue;
    const half = Math.floor(buff / 2);
    buffRandomUnit(nextBoard, buff - half, half, rng, i);
  }
}

function applyCorpseBrokerSell(nextBoard: (UnitInstance | null)[]): void {
  for (let i = 0; i < nextBoard.length; i++) {
    const u = nextBoard[i];
    if (!u || u.id !== "corpse_broker") continue;
    const b = atLevel(CORPSE_BROKER.sellBuff, u.level);
    nextBoard[i] = { ...u, buffAtk: u.buffAtk + b.atk, buffHp: u.buffHp + b.hp };
  }
}

function mergeShopBuffs(
  a: { atk: number; hp: number } | undefined,
  b: { atk: number; hp: number } | undefined,
): { atk: number; hp: number } | undefined {
  if (!a) return b;
  if (!b) return a;
  return { atk: a.atk + b.atk, hp: a.hp + b.hp };
}

export const applySellEffects = (
  soldUnit: UnitInstance,
  currentBoard: (UnitInstance | null)[],
  rng: Rng,
): SellResult => {
  const nextBoard = [...currentBoard];
  // Phase 1: Self-sell triggers (sold unit's own sell ability)
  applyBoneJawSelfSell(soldUnit, nextBoard, rng);
  const selfShopBuff = getRotFeederSelfSellBuff(soldUnit);
  const stockItems = getCorpsePeckerSelfSellItems(soldUnit);
  // Phase 2: Passive sell reactions (remaining board units)
  const passiveShopBuff = collectPassiveShopBuff(nextBoard);
  applyAshFungusSell(soldUnit, nextBoard, rng);
  applyCorpseBrokerSell(nextBoard);
  return {
    board: nextBoard,
    shopBuff: mergeShopBuffs(selfShopBuff, passiveShopBuff),
    stockItems,
  };
};
