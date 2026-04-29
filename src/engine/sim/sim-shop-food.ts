import { ITEMS } from "../../shared/data/items";
import { getItemPool } from "../helpers";
import type { ItemData } from "../../shared/types";
import type { Buff } from "../../shared/skill-params";
import type { SimShopState } from "./sim-shop-effects-util";
import { ITEM_SHOP_SIZES, ITEM_SHOP_SIZE_DEFAULT } from "../constants";
import {
  selectCarryTargets,
  distributeBuffRandomly,
  pickDistinctTargets,
} from "./sim-shop-targeting";
import { STAT_ITEM_UNLOCK_NIGHT } from "./sim-shop-acquisition";

// buildProgressedUnit 側で通常プレイ分の緩やかな stat 蓄積はすでに近似している。
// Cat はそこに上乗せされる「フード重視の終盤運用」のみを薄く追加で表現する。
const BASE_STAT_ITEM_PURCHASES_PER_TURN = 0.08;
const SIM_RECRUITS_PER_LATE_TURN = 0.5;
const EXTRA_BLOOD_TO_FOOD_SHARE = 0.55;
const AVERAGE_STAT_FOOD_COST = 3;
const foodPoolCache = new Map<number, readonly ItemData[]>();

function getItemShopSize(night: number): number {
  return night >= ITEM_SHOP_SIZES[0].minNight ? ITEM_SHOP_SIZES[0].size : ITEM_SHOP_SIZE_DEFAULT;
}

function isSimFood(item: ItemData): boolean {
  return item.cost > 0 && item.effect.kind !== "single_target_equip";
}

function canApplyBoneTreeBoost(state: SimShopState): boolean {
  return state.boneTreeUsesSpent < state.boneTreeTotalUses;
}

function resolveFoodStats(
  state: SimShopState,
  item: ItemData,
  mode: "full" | "cat-extra-only",
): Buff {
  const baseAtk = item.atk;
  const baseHp = item.hp;
  if (!canApplyBoneTreeBoost(state)) {
    return mode === "full" ? { atk: baseAtk, hp: baseHp } : { atk: 0, hp: 0 };
  }
  state.boneTreeUsesSpent += 1;
  const boostedAtk = baseAtk * (1 + state.boneTreeExtraPerFood);
  const boostedHp = baseHp * (1 + state.boneTreeExtraPerFood);
  if (mode === "full") return { atk: boostedAtk, hp: boostedHp };
  return { atk: boostedAtk - baseAtk, hp: boostedHp - baseHp };
}

function applyDescriptorToTeam(
  state: SimShopState,
  item: ItemData,
  excludedUid: string,
  mode: "full" | "cat-extra-only",
): void {
  const stats = resolveFoodStats(state, item, mode);
  if (stats.atk === 0 && stats.hp === 0) return;
  switch (item.effect.kind) {
    case "single_target_stat": {
      const carry = selectCarryTargets(state.team, excludedUid, 1)[0];
      if (!carry) return;
      carry.buffAtk += stats.atk;
      carry.buffHp += stats.hp;
      return;
    }
    case "random_team_stat": {
      const targets = pickDistinctTargets(state.team, item.effect.count, state.rng);
      for (const target of targets) {
        target.buffAtk += stats.atk;
        target.buffHp += stats.hp;
      }
      return;
    }
    case "shop_current_and_future_stat": {
      state.shopBuffAtk += stats.atk;
      state.shopBuffHp += stats.hp;
      return;
    }
    case "single_target_equip":
      return;
  }
}

function getFoodPool(night: number): readonly ItemData[] {
  const cached = foodPoolCache.get(night);
  if (cached) return cached;
  const pool = Object.freeze(
    getItemPool(night)
      .map((itemId) => ITEMS[itemId])
      .filter((item): item is ItemData => !!item)
      .filter(isSimFood),
  );
  foodPoolCache.set(night, pool);
  return pool;
}

function estimateEffectiveFoodCost(night: number, foodPoolSize: number): number {
  const totalItemCount = getItemPool(night).length;
  if (foodPoolSize <= 0 || totalItemCount <= 0) return Infinity;
  const foodShare = foodPoolSize / totalItemCount;
  const hitRate = 1 - Math.pow(1 - foodShare, getItemShopSize(night));
  if (hitRate <= 0) return Infinity;
  const averageRerollsPerHit = Math.max(0, 1 / hitRate - 1);
  return AVERAGE_STAT_FOOD_COST + averageRerollsPerHit;
}

function spendOneFoodPurchase(
  state: SimShopState,
  foodPool: readonly ItemData[],
  excludedUid: string,
  mode: "full" | "cat-extra-only",
): void {
  if (foodPool.length === 0) return;
  const item = foodPool[Math.floor(state.rng.next() * foodPool.length)]!;
  applyDescriptorToTeam(state, item, excludedUid, mode);
}

function applyFoodPurchasesByCount(
  state: SimShopState,
  excludedUid: string,
  purchaseCount: number,
  mode: "full" | "cat-extra-only",
  foodPool: readonly ItemData[] = getFoodPool(state.night),
): void {
  if (purchaseCount <= 0) return;
  if (foodPool.length === 0) return;
  const wholePurchases = Math.floor(purchaseCount);
  for (let i = 0; i < wholePurchases; i++) {
    spendOneFoodPurchase(state, foodPool, excludedUid, mode);
  }
  const remainder = purchaseCount - wholePurchases;
  if (remainder > 0 && state.rng.next() < remainder) {
    spendOneFoodPurchase(state, foodPool, excludedUid, mode);
  }
}

export function applyFoodPurchasesFromBlood(
  state: SimShopState,
  excludedUid: string,
  extraBlood: number,
): void {
  if (extraBlood <= 0) return;
  const foodPool = getFoodPool(state.night);
  const effectiveCost = estimateEffectiveFoodCost(state.night, foodPool.length);
  if (!Number.isFinite(effectiveCost)) return;
  const spendableBlood = extraBlood * EXTRA_BLOOD_TO_FOOD_SHARE;
  applyFoodPurchasesByCount(state, excludedUid, spendableBlood / effectiveCost, "full", foodPool);
}

function getAverageFoodStats(night: number): Buff {
  const pool = getFoodPool(night);
  if (pool.length === 0) return { atk: 0, hp: 0 };
  const total = pool.reduce((acc, item) => ({ atk: acc.atk + item.atk, hp: acc.hp + item.hp }), {
    atk: 0,
    hp: 0,
  });
  return { atk: total.atk / pool.length, hp: total.hp / pool.length };
}

/**
 * ショップ補充アイテム（worm_apple・pure_blood等）を「3-blood食料の置き換え」として差分適用する。
 * SAP "use-it-all" 経済でショップ枠を占有する cost != 3 のアイテムに使用する。
 */
export function applyReplacementFoodPurchases(
  state: SimShopState,
  excludedUid: string,
  item: ItemData,
  purchaseCount: number,
): void {
  if (purchaseCount <= 0 || item.effect.kind === "single_target_equip") return;
  const avg = getAverageFoodStats(state.night);
  const deltaAtk = item.atk - avg.atk;
  const deltaHp = item.hp - avg.hp;
  if (deltaAtk <= 0 && deltaHp <= 0) return;
  const syntheticItem: ItemData = { ...item, atk: Math.max(0, deltaAtk), hp: Math.max(0, deltaHp) };
  const wholePurchases = Math.floor(purchaseCount);
  for (let i = 0; i < wholePurchases; i++) {
    applyDescriptorToTeam(state, syntheticItem, excludedUid, "full");
  }
  const remainder = purchaseCount - wholePurchases;
  if (remainder > 0 && state.rng.next() < remainder) {
    applyDescriptorToTeam(state, syntheticItem, excludedUid, "full");
  }
}

export function applyBoneTreeBaselineDelta(state: SimShopState): void {
  if (state.boneTreeExtraPerFood <= 0) return;
  const lateTurns = Math.max(0, state.night - STAT_ITEM_UNLOCK_NIGHT + 1);
  if (lateTurns <= 0) return;
  const baselinePurchases = lateTurns * BASE_STAT_ITEM_PURCHASES_PER_TURN;
  applyFoodPurchasesByCount(state, "", baselinePurchases, "cat-extra-only");
}

export function materializeShopBuff(state: SimShopState): void {
  if (state.shopBuffAtk === 0 && state.shopBuffHp === 0) return;
  const lateTurns = Math.max(0, state.night - STAT_ITEM_UNLOCK_NIGHT + 1);
  const futureRecruits = Math.max(1, Math.round(lateTurns * SIM_RECRUITS_PER_LATE_TURN));
  distributeBuffRandomly(
    state.team,
    state.shopBuffAtk * futureRecruits,
    state.shopBuffHp * futureRecruits,
    state.rng,
  );
}
