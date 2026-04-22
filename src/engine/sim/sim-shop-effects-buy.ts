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
import {
  activeNights,
  estimateWeightedActions,
  distributeBuffRandomly,
  estimateTeamWinRate,
  levelFraction,
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
 * catacomb_rat: ターン開始時に前夜敗北なら前方3体にATKバフ。
 *
 * 敗北率は teamの推定勝率から算出(強teamほど敗北少)。
 * 旧モデルの固定50%は強teamが常に半分負ける前提で過大評価だった。
 */
export function applyCatacombRatAccumulation(
  catacombRat: UnitInstance,
  team: UnitInstance[],
  night: number,
): void {
  const nights = activeNights(catacombRat.tier as Tier, night);
  if (nights <= 0) return;
  const atkBuff = atLevel(CATACOMB_RAT.atkBuff, catacombRat.level);
  const winRate = estimateTeamWinRate(team, night);
  const lossRate = 1 - winRate;
  const estimatedTriggers = nights * lossRate;
  const targets = team.filter((u) => u.uid !== catacombRat.uid).slice(0, CATACOMB_RAT.targets);
  const buff = Math.floor(atkBuff * estimatedTriggers);
  if (buff <= 0) return;
  for (const t of targets) {
    t.buffAtk += buff;
  }
}

/**
 * ash_fungus (Penguin): ターン開始 – Lv2以上の他味方から最大targets体に+buff/+buff。
 *
 * Lv2達成には素材ユニット購入が必要なため、Lv2条件を満たすのは
 * Tier出現から数ナイト経過後が現実的。ownership累積に Lv2達成遅延を
 * 乗せて早期ナイトの発動を抑制する。
 */
export function applyAshFungusAccumulation(
  ashFungus: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  const buff = atLevel(ASH_FUNGUS.buff, ashFungus.level);
  const eligible = team.filter((u) => u.uid !== ashFungus.uid && u.level >= ASH_FUNGUS.minLevel);
  const targetsPerTrigger = Math.min(ASH_FUNGUS.targets, eligible.length);
  if (targetsPerTrigger <= 0) return;
  // 現teamのLv2以上の割合で ownership重みを減衰させる。
  // team 1/5 しかLv2でない状況なら発動対象が揃わず累積も小さい。
  const lv2Share = levelFraction(team, ASH_FUNGUS.minLevel);
  let weightedNights = 0;
  for (const action of estimateWeightedActions(ashFungus.tier as Tier, night)) {
    weightedNights += action.ownership * lv2Share;
  }
  const totalBuff = Math.floor(weightedNights * buff * targetsPerTrigger);
  if (totalBuff <= 0) return;
  distributeBuffRandomly(eligible, totalBuff, totalBuff, rng);
}

/**
 * altar: ターン終了時にLv3味方がいれば自身にバフ。
 *
 * 発動条件である Lv3友の存在率を team実Lv分布から動的計算。
 * 旧モデルの固定50%は Lv3達成コストを無視した過大評価だった。
 */
const ALTAR_LV3_DELAY_NIGHTS = 3;

export function applyAltarAccumulation(
  altar: UnitInstance,
  team: UnitInstance[],
  night: number,
): void {
  const nights = activeNights(altar.tier as Tier, night);
  if (nights <= 0) return;
  const buff = atLevel(ALTAR.buff, altar.level);
  const lv3Share = levelFraction(team, 3);
  if (lv3Share <= 0) return;
  // Lv3達成はTier出現から数夜遅れて現実化する
  const effectiveNights = Math.max(0, nights - ALTAR_LV3_DELAY_NIGHTS);
  const triggers = Math.floor(effectiveNights * lv3Share);
  if (triggers <= 0) return;
  altar.buffAtk += buff.atk * triggers;
  altar.buffHp += buff.hp * triggers;
}
