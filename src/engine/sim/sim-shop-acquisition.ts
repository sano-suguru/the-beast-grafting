import type { Tier } from "../../shared/data/tiers";
import type { Rng } from "../rng";
import { getCurrentMaxTier } from "../../shared/data/tiers";
import { TIER_APPEAR_NIGHT } from "./sim-types";

export const PURCHASES_PER_NIGHT = 0.6;
const SELLS_PER_NIGHT_LATE = 0.6;
export const STAT_ITEM_UNLOCK_NIGHT = 7;

const SELL_START_NIGHT = 4;
const VIEWS_PER_NIGHT = 3.5;

function shopSlotsAt(night: number): number {
  if (night >= 9) return 5;
  if (night >= 5) return 4;
  return 3;
}

function poolSizeAt(night: number): number {
  return getCurrentMaxTier(night) * 10;
}

function perNightAcquisitionProb(night: number): number {
  const slots = shopSlotsAt(night);
  const pool = poolSizeAt(night);
  return 1 - Math.pow(1 - 1 / pool, slots * VIEWS_PER_NIGHT);
}

interface NightAction {
  readonly night: number;
  readonly ownership: number;
  readonly purchases: number;
  readonly sells: number;
}

const weightedActionsCache = new Map<number, readonly NightAction[]>();

function estimateWeightedActions(tier: Tier, battleNight: number): readonly NightAction[] {
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

export function estimateOwnedTurns(tier: Tier, battleNight: number): number {
  return estimateWeightedActions(tier, battleNight).reduce(
    (sum, action) => sum + action.ownership,
    0,
  );
}

/**
 * 各夜の獲得確率を Bernoulli でサンプリングし、所有していた夜番号の配列を返す。
 * E[length] = estimateOwnedTurns(tier, battleNight) を保ちつつ分散を付与する。
 */
export function sampleOwnedNights(tier: Tier, battleNight: number, rng: Rng): number[] {
  const actions = estimateWeightedActions(tier, battleNight);
  const owned: number[] = [];
  let isOwned = false;
  let prevOwnership = 0;

  for (const action of actions) {
    if (!isOwned) {
      const delta = action.ownership - prevOwnership;
      const notOwnedBefore = 1 - prevOwnership;
      const pAcquire = notOwnedBefore > 0 ? delta / notOwnedBefore : 0;
      if (rng.next() < pAcquire) isOwned = true;
      prevOwnership = action.ownership;
    }
    if (isOwned) owned.push(action.night);
  }

  return owned;
}
