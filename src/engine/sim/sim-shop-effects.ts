import type { UnitInstance } from "../../shared/types";
import type { Rng } from "../rng";
import { applyGutHandAccumulation, applyRotRingAccumulation } from "./sim-shop-effects-buy";
import {
  applyBeggarAccumulation,
  applyBoneJawAccumulation,
  applyCorpseBrokerAccumulation,
  applyCorpsePeckerAccumulation,
  applyRotFeederAccumulation,
} from "./sim-shop-effects-sell";
import {
  applyAltarAccumulation,
  applyAshFungusAccumulation,
  applyCatacombRatAccumulation,
  applyGraftScionAccumulation,
  applyHangedManAccumulation,
  applyRevenantAccumulation,
  applyTaintedPlacentaAccumulation,
} from "./sim-shop-effects-turn";
import {
  applyBoneTreeBaselineDelta,
  createSimShopState,
  materializeShopBuff,
} from "./sim-shop-effects-util";

function applyBuyPhaseEffects(unit: UnitInstance, team: UnitInstance[], night: number, rng: Rng) {
  switch (unit.id) {
    case "gut_hand":
      return applyGutHandAccumulation(unit, team, night, rng);
    case "rot_ring":
      return applyRotRingAccumulation(unit, team, night, rng);
  }
}

function applyStartOfTurnEffects(
  unit: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
  state: ReturnType<typeof createSimShopState>,
) {
  switch (unit.id) {
    case "revenant":
      return applyRevenantAccumulation(unit, team, night, rng);
    case "graft_scion":
      return applyGraftScionAccumulation(unit, state);
    case "ash_fungus":
      return applyAshFungusAccumulation(unit, team, night, rng);
    case "tainted_placenta":
      return applyTaintedPlacentaAccumulation(unit, state);
  }
}

function applyEndOfTurnEffects(unit: UnitInstance, team: UnitInstance[], night: number, rng: Rng) {
  switch (unit.id) {
    case "catacomb_rat":
      return applyCatacombRatAccumulation(unit, team, night, rng);
    case "altar":
      return applyAltarAccumulation(unit, team, night, rng);
    case "hanged_man":
      return applyHangedManAccumulation(unit, team, night, rng);
  }
}

function applySellPhaseEffects(
  unit: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
  state: ReturnType<typeof createSimShopState>,
) {
  switch (unit.id) {
    case "corpse_broker":
      return applyCorpseBrokerAccumulation(unit, team, night, rng);
    case "bone_jaw":
      return applyBoneJawAccumulation(unit, team, night, rng);
    case "rot_feeder":
      return applyRotFeederAccumulation(unit, team, night, rng);
    case "corpse_pecker":
      return applyCorpsePeckerAccumulation(unit, team, night, rng);
    case "beggar":
      return applyBeggarAccumulation(unit, state);
  }
}

/**
 * チーム構成に基づくショップスキルの累積効果を適用する。
 * buildRealisticTeam 後、simulateBattleSim 前に呼び出す。
 */
export function applySimShopEffects(team: UnitInstance[], night: number, rng: Rng): void {
  const state = createSimShopState(team, night, rng);
  for (const unit of team) {
    applyStartOfTurnEffects(unit, team, night, rng, state);
    applyBuyPhaseEffects(unit, team, night, rng);
    applySellPhaseEffects(unit, team, night, rng, state);
    applyEndOfTurnEffects(unit, team, night, rng);
  }
  applyBoneTreeBaselineDelta(state);
  materializeShopBuff(state);
}
