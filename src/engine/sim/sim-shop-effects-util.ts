import type { Tier } from "../../shared/data/tiers";
import type { UnitInstance } from "../../shared/types";
import type { Rng } from "../rng";
import { TIER_APPEAR_NIGHT } from "./sim-types";
import { getCurrentMaxTier } from "../../shared/data/tiers";

/**
 * ナイトあたりの購入・売却回数（ゲーム経済から導出）。
 *
 * 10 blood の配分:
 * - ロール: 2-3回 (2-3 blood) — 高Tier Nightほどロール多い
 * - ユニット購入: 1-2回 (3-6 blood) — UNIT_COST=3
 * - アイテム購入: 0-1回 (3-5 blood)
 * - 売却収入: +1-2 blood（Night 3以降）
 *
 * ユニット入手初Nightは途中からの発動（ショップスキル持ちを先に買うとは限らない）。
 */
const PURCHASES_PER_NIGHT = 0.6;
const SELLS_PER_NIGHT_LATE = 0.6;
const SELL_START_NIGHT = 4;

/** 1ナイトあたりのショップ閲覧回数（初期表示 + 平均ロール回数） */
const VIEWS_PER_NIGHT = 3.5;

/** Night N のショップスロット数（engine/constants.ts の SHOP_SIZES に準拠） */
function shopSlotsAt(night: number): number {
  if (night >= 9) return 5;
  if (night >= 5) return 4;
  return 3;
}

/** Night N のプールサイズ（Tier 10体ずつ均等） */
function poolSizeAt(night: number): number {
  return getCurrentMaxTier(night) * 10;
}

export function activeNights(tier: Tier, battleNight: number): number {
  return Math.max(0, battleNight - TIER_APPEAR_NIGHT[tier] + 1);
}

/**
 * 1ナイトにそのユニットを発見・購入できる確率（幾何分布モデル）。
 *
 * ショップはプールから復元抽出（pickRandom）なので幾何分布が正確なモデル。
 */
function perNightAcquisitionProb(night: number): number {
  const slots = shopSlotsAt(night);
  const pool = poolSizeAt(night);
  return 1 - Math.pow(1 - 1 / pool, slots * VIEWS_PER_NIGHT);
}

interface NightAction {
  readonly night: number;
  /** 所有確率（このナイトまでにユニットを保有している確率） */
  readonly ownership: number;
  /** 所有確率で重み付けされた推定購入回数 */
  readonly purchases: number;
  /** 所有確率で重み付けされた推定売却回数 */
  readonly sells: number;
}

const weightedActionsCache = new Map<number, readonly NightAction[]>();

/**
 * Tier出現ナイトからbattleNightまでの、所有確率で重み付けされた推定行動量を返す。
 *
 * 従来の「Tier出現ナイト = 保有開始ナイト」仮定を geometric CDF で置換する。
 * プールが小さいTier1は早期収束（Night 1-2で所有確率~90%）、
 * プールが大きい高Tierほど収束が遅くなり累積量が自然に抑制される。
 * キャッシュ済み（GAの数百万回呼び出しに対応）。
 */
export function estimateWeightedActions(tier: Tier, battleNight: number): readonly NightAction[] {
  const key = tier * 100 + battleNight;
  const cached = weightedActionsCache.get(key);
  if (cached) return cached;

  const appearNight = TIER_APPEAR_NIGHT[tier];
  const result: NightAction[] = [];
  let notOwned = 1.0;

  for (let n = appearNight; n <= battleNight; n++) {
    const p = perNightAcquisitionProb(n);
    notOwned *= 1 - p;
    const weight = 1 - notOwned;

    result.push({
      night: n,
      ownership: weight,
      purchases: PURCHASES_PER_NIGHT * weight,
      sells: n >= SELL_START_NIGHT ? SELLS_PER_NIGHT_LATE * weight : 0,
    });
  }

  const frozen = Object.freeze(result);
  weightedActionsCache.set(key, frozen);
  return frozen;
}

export function distributeBuffRandomly(
  team: UnitInstance[],
  atk: number,
  hp: number,
  rng: Rng,
): void {
  if (team.length === 0) return;
  const perUnitAtk = Math.floor(atk / team.length);
  const perUnitHp = Math.floor(hp / team.length);
  for (const u of team) {
    u.buffAtk += perUnitAtk;
    u.buffHp += perUnitHp;
  }
  const remainder = { atk: atk - perUnitAtk * team.length, hp: hp - perUnitHp * team.length };
  if (remainder.atk > 0 || remainder.hp > 0) {
    const target = team[Math.floor(rng.next() * team.length)]!;
    target.buffAtk += remainder.atk;
    target.buffHp += remainder.hp;
  }
}

/**
 * team強度の推定勝率(対ランダム相当)。
 *
 * team全体の合計ステータス(HPは0.7重み)とNight標準値をロジスティックで比較。
 * 継続発動型の発動条件(catacomb_ratの敗北率、altarのLv3友存在率)の動的化に使う。
 *
 * ランダム vs ランダムで ~0.43 勝率(Night 12, sim-results/latest)に校正。
 */
export function estimateTeamWinRate(team: readonly UnitInstance[], night: number): number {
  if (team.length === 0) return 0.5;
  const power = team.reduce((s, u) => s + (u.baseAtk + u.buffAtk) + (u.baseHp + u.buffHp) * 0.7, 0);
  // Night別の基準ライン(随時校正)。Night 12 ランダムteam ~75 を0.5付近にマップ。
  const baseline = 45 + night * 2.5;
  const scale = 20;
  const z = (power - baseline) / scale;
  return 1 / (1 + Math.exp(-z));
}

/** teamに含まれるLv>=targetLevelの比率 */
export function levelFraction(team: readonly UnitInstance[], targetLevel: number): number {
  if (team.length === 0) return 0;
  const count = team.reduce((s, u) => s + (u.level >= targetLevel ? 1 : 0), 0);
  return count / team.length;
}
