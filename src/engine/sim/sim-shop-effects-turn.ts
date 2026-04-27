import type { UnitInstance } from "../../shared/types";
import type { Tier } from "../../shared/data/tiers";
import type { Rng } from "../rng";
import { ITEMS } from "../../shared/data/items";
import { atLevel, REVENANT } from "../../shared/skill-params";
import {
  ALTAR,
  ASH_FUNGUS,
  CATACOMB_RAT,
  GRAFT_SCION,
  HANGED_MAN,
  TAINTED_PLACENTA,
} from "../../shared/skill-params-shop";
import {
  applyFoodPurchasesFromBlood,
  applySpecificFoodPurchases,
  type SimShopState,
  distributeBuffRandomly,
  estimateTeamWinRate,
  levelFraction,
  sampleOwnedNights,
  selectCarryTargets,
  STAT_ITEM_UNLOCK_NIGHT,
} from "./sim-shop-effects-util";

export function applyRevenantAccumulation(
  revenant: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  const ownedNights = sampleOwnedNights(revenant.tier as Tier, night, rng);
  if (ownedNights.length === 0) return;
  const targets = selectCarryTargets(team, revenant.uid, atLevel(REVENANT.targets, revenant.level));
  if (targets.length === 0) return;
  const atkGain = Math.floor(ownedNights.length * REVENANT.buff.atk);
  const hpGain = Math.floor(ownedNights.length * REVENANT.buff.hp);
  if (atkGain <= 0 && hpGain <= 0) return;
  for (const target of targets) {
    target.buffAtk += atkGain;
    target.buffHp += hpGain;
  }
}

export function applyGraftScionAccumulation(graftScion: UnitInstance, state: SimShopState): void {
  const ownedNights = sampleOwnedNights(graftScion.tier as Tier, state.night, state.rng);
  if (ownedNights.length === 0) return;
  const stockedItem = ITEMS[atLevel(GRAFT_SCION.itemId, graftScion.level)];
  const consumedCount = Math.floor(ownedNights.length * 0.75);
  if (consumedCount <= 0) return;
  applySpecificFoodPurchases(state, graftScion.uid, stockedItem, consumedCount);
}

export function applyCatacombRatAccumulation(
  catacombRat: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  const ownedNights = sampleOwnedNights(catacombRat.tier as Tier, night, rng);
  if (ownedNights.length === 0) return;
  const atkBuff = atLevel(CATACOMB_RAT.atkBuff, catacombRat.level);
  const lossRate = 1 - estimateTeamWinRate(team, night);
  const estimatedTriggers = ownedNights.length * lossRate;
  const targets = selectCarryTargets(team, catacombRat.uid, CATACOMB_RAT.targets);
  const buff = Math.floor(atkBuff * estimatedTriggers);
  if (targets.length === 0 || buff <= 0) return;
  for (const target of targets) {
    target.buffAtk += buff;
  }
}

export function applyAshFungusAccumulation(
  ashFungus: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  const buff = atLevel(ASH_FUNGUS.buff, ashFungus.level);
  const eligible = team.filter((u) => u.uid !== ashFungus.uid && u.level >= ASH_FUNGUS.minLevel);
  const targetsPerTrigger = Math.min(ASH_FUNGUS.targets, eligible.length);
  if (targetsPerTrigger <= 0) return;
  const lv2Share = levelFraction(team, ASH_FUNGUS.minLevel);
  const ownedNights = sampleOwnedNights(ashFungus.tier as Tier, night, rng);
  const totalBuff = Math.floor(ownedNights.length * lv2Share * buff * targetsPerTrigger);
  if (totalBuff <= 0) return;
  distributeBuffRandomly(eligible, totalBuff, totalBuff, rng);
}

const ALTAR_LV3_DELAY_NIGHTS = 3;

export function applyAltarAccumulation(
  altar: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  const ownedNights = sampleOwnedNights(altar.tier as Tier, night, rng);
  if (ownedNights.length === 0) return;
  const buff = atLevel(ALTAR.buff, altar.level);
  const lv3Share = levelFraction(team, 3);
  if (lv3Share <= 0) return;
  const effectiveTurns = Math.max(0, ownedNights.length - ALTAR_LV3_DELAY_NIGHTS);
  const triggers = Math.floor(effectiveTurns * lv3Share);
  if (triggers <= 0) return;
  altar.buffAtk += buff.atk * triggers;
  altar.buffHp += buff.hp * triggers;
}

export function applyHangedManAccumulation(
  hangedMan: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  const ownedNights = sampleOwnedNights(hangedMan.tier as Tier, night, rng);
  if (ownedNights.length === 0) return;
  const buff = atLevel(HANGED_MAN.buff, hangedMan.level);
  const carry = selectCarryTargets(team, hangedMan.uid, 1)[0];
  if (!carry) return;
  carry.buffAtk += Math.floor(ownedNights.length * buff.atk);
  carry.buffHp += Math.floor(ownedNights.length * buff.hp);
}

export function applyTaintedPlacentaAccumulation(
  taintedPlacenta: UnitInstance,
  state: SimShopState,
): void {
  const ownedNights = sampleOwnedNights(taintedPlacenta.tier as Tier, state.night, state.rng);
  const lateNightCount = ownedNights.filter((n) => n >= STAT_ITEM_UNLOCK_NIGHT).length;
  if (lateNightCount === 0) return;
  const extraBlood = lateNightCount * atLevel(TAINTED_PLACENTA.bloodGain, taintedPlacenta.level);
  if (extraBlood <= 0) return;
  applyFoodPurchasesFromBlood(state, taintedPlacenta.uid, extraBlood);
}
