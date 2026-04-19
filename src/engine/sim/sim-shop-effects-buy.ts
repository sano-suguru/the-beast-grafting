import type { UnitInstance } from "../../shared/types";
import type { Tier } from "../../shared/data/tiers";
import type { Rng } from "../rng";
import { atLevel } from "../../shared/skill-params";
import { GUT_HAND, ROT_RING, TAINTED_PLACENTA } from "../../shared/skill-params-shop";
import {
  activeNights,
  estimateWeightedActions,
  distributeBuffRandomly,
  PLACENTA_START_CONVERSION,
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
  const nights = activeNights(gutHand.tier as Tier, night);
  if (nights <= 0) return;
  // gut_hand は自身が購入された時のみ発動する一回性スキル
  const targets = atLevel(GUT_HAND.targets, gutHand.level);
  const totalHp = GUT_HAND.hpBuff * targets;
  distributeBuffRandomly(team, 0, totalHp, rng);
}

/**
 * rot_ring: Tier1ユニット購入時に盤面全体へ +buff/+buff（上限: uses回/夜）。
 *
 * maxUses は夜あたり上限（rotRingUses は夜ごとにサーバーでリセット）。
 * Tier1購入頻度 = weighted purchases × tier1FractionAtNight を夜ごとに推定し、
 * 夜ごとに maxUses でキャップしてから累積する。
 */
export function applyRotRingAccumulation(
  rotRing: UnitInstance,
  team: UnitInstance[],
  night: number,
): void {
  const nights = activeNights(rotRing.tier as Tier, night);
  if (nights <= 0) return;

  const maxUses = atLevel(ROT_RING.uses, rotRing.level);
  let potentialTriggers = 0;
  for (const action of estimateWeightedActions(rotRing.tier as Tier, night)) {
    const nightTriggers = action.purchases * tier1FractionAtNight(action.night);
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

/**
 * tainted_placenta: ターン開始でショップランダム1体にバフ → PLACENTA_START_CONVERSIONでチームに還元。
 *
 * バフはターン開始時に視認可能なため、プレイヤーが意図的に購入できる。
 * ナイトごとに1回発動 × PLACENTA_START_CONVERSION = 0.25 の購入確率で累積。
 */
export function applyTaintedPlacentaAccumulation(
  placenta: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  const nights = activeNights(placenta.tier as Tier, night);
  if (nights <= 0) return;

  const shopBuff = atLevel(TAINTED_PLACENTA.shopBuff, placenta.level);
  const totalAtk = Math.floor(shopBuff.atk * nights * PLACENTA_START_CONVERSION);
  const totalHp = Math.floor(shopBuff.hp * nights * PLACENTA_START_CONVERSION);
  if (totalAtk === 0 && totalHp === 0) return;
  distributeBuffRandomly(team, totalAtk, totalHp, rng);
}
