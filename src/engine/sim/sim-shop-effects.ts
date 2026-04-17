import type { UnitInstance } from "../../shared/types";
import type { Rng } from "../rng";
import {
  applyBoneTreeAccumulation,
  applyGhoulInfantAccumulation,
  applyRotRingAccumulation,
} from "./sim-shop-effects-buy";
import {
  applyAshFungusAccumulation,
  applyCorpseBrokerAccumulation,
  applyGraveWormAccumulation,
  applyMarketVultureAccumulation,
} from "./sim-shop-effects-sell";

/**
 * チーム構成に基づくショップスキルの累積効果を適用する。
 * buildRealisticTeam 後、simulateBattleSim 前に呼び出す。
 */
export function applySimShopEffects(team: UnitInstance[], night: number, rng: Rng): void {
  for (const unit of team) {
    switch (unit.id) {
      case "bone_tree":
        applyBoneTreeAccumulation(unit, team, night);
        break;
      case "ghoul_infant":
        applyGhoulInfantAccumulation(unit, team, night, rng);
        break;
      case "ash_fungus":
        applyAshFungusAccumulation(unit, team, night, rng);
        break;
      case "corpse_broker":
        applyCorpseBrokerAccumulation(unit, night);
        break;
      case "grave_worm":
        applyGraveWormAccumulation(unit, team, night, rng);
        break;
      case "market_vulture":
        applyMarketVultureAccumulation(unit, team, night, rng);
        break;
      case "rot_ring":
        applyRotRingAccumulation(unit, team, night);
        break;
    }
  }
}
