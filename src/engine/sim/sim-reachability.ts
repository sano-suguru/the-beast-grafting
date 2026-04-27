import type { RegularUnitId } from "../../shared/types";
import type { Tier } from "../../shared/data/tiers";
import { lookupUnitData } from "../../shared/data/unit-lookup";
import { invariant } from "../../shared/invariant";
import { TIER_APPEAR_NIGHT } from "./sim-types";
import { estimateOwnedTurns } from "./sim-shop-acquisition";

/**
 * 編成の「到達可能性スコア」= 全メンバーを night までに獲得できる確率の独立近似積。
 * 各ユニットの所有確率: estimateOwnedTurns / maxOwnableNights (クランプ 0–1)。
 */
export function computeReachabilityScore(ids: readonly RegularUnitId[], night: number): number {
  if (ids.length === 0) return 1;
  let score = 1;
  for (const id of ids) {
    const unit = lookupUnitData(id);
    invariant(unit, `unknown RegularUnitId in sim-reachability: ${id}`);
    const tier = unit.tier as Tier;
    const maxOwnable = Math.max(1, night - TIER_APPEAR_NIGHT[tier] + 1);
    const ownProb = Math.min(1, estimateOwnedTurns(tier, night) / maxOwnable);
    score *= ownProb;
  }
  return score;
}
