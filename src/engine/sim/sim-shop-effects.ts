import type { UnitInstance } from "../../shared/types";
import type { Rng } from "../rng";
import {
  applyGutHandAccumulation,
  applyRotRingAccumulation,
  applyMarketVultureAccumulation,
  applyCatacombRatAccumulation,
  applyAshFungusAccumulation,
  applyAltarAccumulation,
} from "./sim-shop-effects-buy";
import {
  applyBoneJawAccumulation,
  applyCorpseBrokerAccumulation,
  applyCorpsePeckerAccumulation,
  applyRotFeederAccumulation,
} from "./sim-shop-effects-sell";

function applyBuyPhaseEffects(unit: UnitInstance, team: UnitInstance[], night: number, rng: Rng) {
  switch (unit.id) {
    case "gut_hand":
      return applyGutHandAccumulation(unit, team, night, rng);
    case "rot_ring":
      return applyRotRingAccumulation(unit, team, night);
    case "market_vulture":
      return applyMarketVultureAccumulation(unit, team, night);
    case "catacomb_rat":
      return applyCatacombRatAccumulation(unit, team, night);
  }
}

function applyTurnPhaseEffects(unit: UnitInstance, team: UnitInstance[], night: number, rng: Rng) {
  switch (unit.id) {
    case "ash_fungus":
      return applyAshFungusAccumulation(unit, team, night, rng);
    case "altar":
      return applyAltarAccumulation(unit, night);
  }
}

function applySellPhaseEffects(unit: UnitInstance, team: UnitInstance[], night: number, rng: Rng) {
  switch (unit.id) {
    case "corpse_broker":
      return applyCorpseBrokerAccumulation(unit, team, night, rng);
    case "bone_jaw":
      return applyBoneJawAccumulation(unit, team, night, rng);
    case "rot_feeder":
      return applyRotFeederAccumulation(unit, team, night, rng);
    case "corpse_pecker":
      return applyCorpsePeckerAccumulation(unit, team, night, rng);
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
    applyTurnPhaseEffects(unit, team, night, rng);
  }
}
