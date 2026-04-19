import type { UnitInstance } from "../../shared/types";
import type { Rng } from "../rng";
import {
  applyGutHandAccumulation,
  applyRotRingAccumulation,
  applyTaintedPlacentaAccumulation,
} from "./sim-shop-effects-buy";
import {
  applyAshFungusAccumulation,
  applyBoneJawAccumulation,
  applyCorpseBrokerAccumulation,
  applyCorpsePeckerAccumulation,
  applyMarketVultureAccumulation,
  applyRotFeederAccumulation,
} from "./sim-shop-effects-sell";

function applyBuyPhaseEffects(unit: UnitInstance, team: UnitInstance[], night: number, rng: Rng) {
  switch (unit.id) {
    case "gut_hand":
      return applyGutHandAccumulation(unit, team, night, rng);
    case "rot_ring":
      return applyRotRingAccumulation(unit, team, night);
    case "tainted_placenta":
      return applyTaintedPlacentaAccumulation(unit, team, night, rng);
  }
}

function applySellPhaseEffects(unit: UnitInstance, team: UnitInstance[], night: number, rng: Rng) {
  switch (unit.id) {
    case "ash_fungus":
      return applyAshFungusAccumulation(unit, team, night, rng);
    case "corpse_broker":
      return applyCorpseBrokerAccumulation(unit, night);
    case "bone_jaw":
      return applyBoneJawAccumulation(unit, team, night, rng);
    case "rot_feeder":
      return applyRotFeederAccumulation(unit, team, night, rng);
    case "corpse_pecker":
      return applyCorpsePeckerAccumulation(unit, team, night, rng);
    case "market_vulture":
      return applyMarketVultureAccumulation(unit, team, night, rng);
  }
}

/**
 * チーム構成に基づくショップスキルの累積効果を適用する。
 * buildRealisticTeam 後、simulateBattleSim 前に呼び出す。
 */
export function applySimShopEffects(team: UnitInstance[], night: number, rng: Rng): void {
  for (const unit of team) {
    applyBuyPhaseEffects(unit, team, night, rng);
    applySellPhaseEffects(unit, team, night, rng);
  }
}
