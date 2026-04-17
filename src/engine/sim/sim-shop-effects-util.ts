import type { UnitInstance } from "../../shared/types";
import type { Tier } from "../../shared/data/tiers";
import type { Rng } from "../rng";
import { TIER_APPEAR_NIGHT } from "./sim-types";

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
export const PURCHASES_PER_NIGHT = 0.6;
const SELLS_PER_NIGHT_LATE = 0.6;
const SELL_START_NIGHT = 4;

/** 入手初Night は途中からの発動。以降は完全に発動。 */
export const FIRST_NIGHT_FRACTION = 0.5;

/** ナイトあたりの購入・売却回数を推定 */
export function estimateNightActions(
  night: number,
  isFirstActiveNight: boolean,
): { purchases: number; sells: number } {
  const fraction = isFirstActiveNight ? FIRST_NIGHT_FRACTION : 1.0;
  const purchases = PURCHASES_PER_NIGHT * fraction;
  const sells = night >= SELL_START_NIGHT ? SELLS_PER_NIGHT_LATE * fraction : 0;
  return { purchases, sells };
}

export function activeNights(tier: Tier, battleNight: number): number {
  return Math.max(0, battleNight - TIER_APPEAR_NIGHT[tier] + 1);
}

/** ランダムに味方1体ずつバフを分配（合計値を等分） */
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
