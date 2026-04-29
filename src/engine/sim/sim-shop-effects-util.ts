import type { UnitInstance } from "../../shared/types";
import type { Tier } from "../../shared/data/tiers";
import type { Rng } from "../rng";
import { CAT } from "../../shared/skill-params-shop";
import { atLevel } from "../../shared/skill-params";
import { estimateOwnedTurns } from "./sim-shop-acquisition";

export {
  PURCHASES_PER_NIGHT,
  STAT_ITEM_UNLOCK_NIGHT,
  sampleOwnedNights,
} from "./sim-shop-acquisition";

export {
  selectCarryTargets,
  distributeBuffRandomly,
  estimateTeamWinRate,
  levelFraction,
} from "./sim-shop-targeting";

export {
  applyFoodPurchasesFromBlood,
  applyReplacementFoodPurchases,
  applyBoneTreeBaselineDelta,
  materializeShopBuff,
} from "./sim-shop-food";

export interface SimShopState {
  readonly team: UnitInstance[];
  readonly night: number;
  readonly rng: Rng;
  shopBuffAtk: number;
  shopBuffHp: number;
  boneTreeUsesSpent: number;
  readonly boneTreeTotalUses: number;
  readonly boneTreeExtraPerFood: number;
}

export function createSimShopState(team: UnitInstance[], night: number, rng: Rng): SimShopState {
  const cats = team.filter((unit) => unit.id === "bone_tree");
  return {
    team,
    night,
    rng,
    shopBuffAtk: 0,
    shopBuffHp: 0,
    boneTreeUsesSpent: 0,
    boneTreeTotalUses: Math.round(
      cats.reduce(
        (sum, cat) =>
          sum + estimateOwnedTurns(cat.tier as Tier, night) * atLevel(CAT.uses, cat.level),
        0,
      ),
    ),
    boneTreeExtraPerFood: cats.reduce((sum, cat) => sum + atLevel(CAT.multPerCat, cat.level), 0),
  };
}
