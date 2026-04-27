import { unitInstanceToBoardUnit } from "../../shared/board-unit";
import { getCurrentMaxTier, nextTier } from "../../shared/data/tiers";
import type { StatefulRng } from "../../engine/rng";
import { createUnit, getUnitsByTier, pickRandom } from "../../engine/helpers";
import { LEVEL_UP_REWARD_COUNT } from "../../engine/constants";
import type { ShopSlotJson } from "../../db/shop-state-types";

export function generateLevelUpRewards(
  leveledUp: boolean,
  night: number,
  rng: StatefulRng,
): ShopSlotJson[] {
  if (!leveledUp) return [];
  const rewardTier = nextTier(getCurrentMaxTier(night));
  const candidates = getUnitsByTier(rewardTier);
  if (candidates.length === 0) return [];
  return Array.from({ length: LEVEL_UP_REWARD_COUNT }, () => ({
    unit: unitInstanceToBoardUnit(createUnit(pickRandom([...candidates], rng))),
    frozen: false,
    eventSourced: false,
  }));
}
