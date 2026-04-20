import type { UnitInstance } from "../../shared/types";
import type { Tier } from "../../shared/data/tiers";
import type { Rng } from "../rng";
import { atLevel } from "../../shared/skill-params";
import {
  GUT_HAND,
  ROT_RING,
  CATACOMB_RAT,
  ASH_FUNGUS,
  ALTAR,
} from "../../shared/skill-params-shop";
import { MARKET_VULTURE } from "../../shared/skill-params";
import {
  activeNights,
  estimateWeightedActions,
  distributeBuffRandomly,
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
 * market_vulture: 開戦時に味方最大HPの X% を自身HPに加算。
 * SoB 1回/戦なので activeNights 分累積。
 */
export function applyMarketVultureAccumulation(
  vulture: UnitInstance,
  team: UnitInstance[],
  night: number,
): void {
  const nights = activeNights(vulture.tier as Tier, night);
  if (nights <= 0) return;
  let maxHp = 0;
  for (const ally of team) {
    if (ally.uid === vulture.uid) continue;
    const total = ally.baseHp + ally.buffHp;
    if (total > maxHp) maxHp = total;
  }
  if (maxHp === 0) return;
  const percent = atLevel(MARKET_VULTURE.percent, vulture.level);
  vulture.buffHp += Math.max(1, Math.floor((maxHp * percent) / 100)) * nights;
}

/**
 * catacomb_rat: ターン開始時に前夜敗北なら前方3体にATKバフ。
 * 敗北確率 50% 仮定で activeNights × 0.5 回分を前方ユニットに分配。
 */
export function applyCatacombRatAccumulation(
  catacombRat: UnitInstance,
  team: UnitInstance[],
  night: number,
): void {
  const nights = activeNights(catacombRat.tier as Tier, night);
  if (nights <= 0) return;
  const atkBuff = atLevel(CATACOMB_RAT.atkBuff, catacombRat.level);
  const estimatedTriggers = nights * 0.5;
  const targets = team.filter((u) => u.uid !== catacombRat.uid).slice(0, CATACOMB_RAT.targets);
  for (const t of targets) {
    t.buffAtk += Math.floor(atkBuff * estimatedTriggers);
  }
}

/**
 * ash_fungus (Penguin): ターン開始 – Lv2以上の味方2体に+buff/+buff。
 * 対象数をチーム内Lv2+ユニット数で制限し、activeNights × targets × buff を近似分配。
 */
export function applyAshFungusAccumulation(
  ashFungus: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  const nights = activeNights(ashFungus.tier as Tier, night);
  if (nights <= 0) return;
  const buff = atLevel(ASH_FUNGUS.buff, ashFungus.level);
  const eligible = team.filter((u) => u.uid !== ashFungus.uid && u.level >= ASH_FUNGUS.minLevel);
  const targetsPerTrigger = Math.min(ASH_FUNGUS.targets, eligible.length);
  if (targetsPerTrigger <= 0) return;
  const totalBuff = nights * buff * targetsPerTrigger;
  distributeBuffRandomly(team, totalBuff, totalBuff, rng);
}

/**
 * altar: ターン終了時にLv3味方がいれば自身にバフ。
 * sim 用の粗推定 — 実ゲーム計算からは参照しない。
 */
const ALTAR_HIGH_LEVEL_FRIEND_PRESENCE_ESTIMATE = 0.5;

export function applyAltarAccumulation(altar: UnitInstance, night: number): void {
  const nights = activeNights(altar.tier as Tier, night);
  if (nights <= 0) return;
  const buff = atLevel(ALTAR.buff, altar.level);
  const triggers = Math.floor(nights * ALTAR_HIGH_LEVEL_FRIEND_PRESENCE_ESTIMATE);
  if (triggers <= 0) return;
  altar.buffAtk += buff.atk * triggers;
  altar.buffHp += buff.hp * triggers;
}
