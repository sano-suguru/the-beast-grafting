import type { UnitInstance } from "../../shared/types";
import type { Tier } from "../../shared/data/tiers";
import type { Rng } from "../rng";
import { atLevel } from "../../shared/skill-params";
import { CHALICE, GUT_HAND, ROT_RING } from "../../shared/skill-params-shop";
import { ITEMS } from "../../shared/data/items";
import {
  applyFoodPurchasesFromBlood,
  applyReplacementFoodPurchases,
  distributeBuffRandomly,
  PURCHASES_PER_NIGHT,
  sampleOwnedNights,
  type SimShopState,
} from "./sim-shop-effects-util";

/** Night N のショッププール内でTier 1が占める割合 (全Tier 10体ずつ均等) */
function tier1FractionAtNight(night: number): number {
  if (night >= 11) return 1 / 6;
  if (night >= 9) return 1 / 5;
  if (night >= 7) return 1 / 4;
  if (night >= 5) return 1 / 3;
  if (night >= 3) return 1 / 2;
  return 1;
}

export function applyGutHandAccumulation(
  gutHand: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  const ownedNights = sampleOwnedNights(gutHand.tier as Tier, night, rng);
  if (ownedNights.length === 0) return;
  // gut_hand は自身が購入された時のみ発動する一回性スキル
  const targets = atLevel(GUT_HAND.targets, gutHand.level);
  const totalHp = GUT_HAND.hpBuff * targets;
  distributeBuffRandomly(team, 0, totalHp, rng);
}

/**
 * rot_ring: Tier1ユニット購入時に盤面全体へ +buff/+buff（上限: uses回/夜）。
 *
 * maxUses は夜あたり上限（rotRingUses は夜ごとにサーバーでリセット）。
 * Tier1購入頻度 = PURCHASES_PER_NIGHT × tier1FractionAtNight を夜ごとに推定し、
 * 夜ごとに maxUses でキャップしてから累積する。
 */
export function applyRotRingAccumulation(
  rotRing: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  const ownedNights = sampleOwnedNights(rotRing.tier as Tier, night, rng);
  if (ownedNights.length === 0) return;

  const maxUses = atLevel(ROT_RING.uses, rotRing.level);
  let potentialTriggers = 0;
  for (const n of ownedNights) {
    const nightTriggers = PURCHASES_PER_NIGHT * tier1FractionAtNight(n);
    potentialTriggers += Math.min(nightTriggers, maxUses);
  }

  const ringBuff = atLevel(ROT_RING.buff, rotRing.level);
  const buffAtk = Math.floor(potentialTriggers * ringBuff.atk);
  const buffHp = Math.floor(potentialTriggers * ringBuff.hp);
  if (buffAtk <= 0 && buffHp <= 0) return;

  for (const u of team) {
    u.buffAtk += buffAtk;
    u.buffHp += buffHp;
  }
}

const CHALICE_REPLACED_SLOTS = 2;
const PURE_BLOOD_COST = 0;
const STANDARD_FOOD_COST = 3;

export function applyChaliceAccumulation(chalice: UnitInstance, state: SimShopState): void {
  const item = ITEMS[atLevel(CHALICE.itemId, chalice.level)];
  applyReplacementFoodPurchases(state, chalice.uid, item, CHALICE_REPLACED_SLOTS);
  const savedBlood = CHALICE_REPLACED_SLOTS * (STANDARD_FOOD_COST - PURE_BLOOD_COST);
  applyFoodPurchasesFromBlood(state, chalice.uid, savedBlood);
}
