import type { UnitInstance } from "../../shared/types";
import type { Tier } from "../../shared/data/tiers";
import type { Rng } from "../rng";
import { atLevel } from "../../shared/skill-params";
import {
  BONE_JAW,
  CORPSE_BROKER,
  CORPSE_PECKER,
  ROT_FEEDER,
  sellBloodGain,
} from "../../shared/skill-params-shop";
import {
  applyFoodPurchasesFromBlood,
  type SimShopState,
  distributeBuffRandomly,
  sampleOwnedNights,
} from "./sim-shop-effects-util";

export function applyCorpseBrokerAccumulation(
  broker: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  const ownedNights = sampleOwnedNights(broker.tier as Tier, night, rng);
  if (ownedNights.length === 0) return;

  const hpBuff = atLevel(CORPSE_BROKER.hpBuff, broker.level);
  const maxUses = CORPSE_BROKER.maxUses;

  // maxUses はユニット生存中の総使用上限(shop-effects-dose.ts 参照)。
  // 投与機会はアイテム購入頻度に近似(平均 0.5回/夜)するが、総量は maxUses で打ち切る。
  const dosesPerNight = 0.5;
  const totalDoses = Math.min(Math.floor(dosesPerNight * ownedNights.length), maxUses);
  if (totalDoses <= 0) return;

  const totalHp = hpBuff * totalDoses;
  distributeBuffRandomly(team, 0, totalHp, rng);
}

export function applyBoneJawAccumulation(
  boneJaw: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  const ownedNights = sampleOwnedNights(boneJaw.tier as Tier, night, rng);
  if (ownedNights.length === 0) return;
  // Self-sell: one-time ATK buff to allies when sold
  const atkBuff = atLevel(BONE_JAW.atkBuff, boneJaw.level);
  distributeBuffRandomly(team, atkBuff * BONE_JAW.targets, 0, rng);
}

function applyOneShotSellBuff(
  unit: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
  atkBuff: number,
  hpBuff: number,
): void {
  if (sampleOwnedNights(unit.tier as Tier, night, rng).length === 0) return;
  if (atkBuff > 0 || hpBuff > 0) distributeBuffRandomly(team, atkBuff, hpBuff, rng);
}

export function applyRotFeederAccumulation(
  rotFeeder: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  // Self-sell: one-time shop HP buff → approximate as 50% team HP buff
  applyOneShotSellBuff(
    rotFeeder,
    team,
    night,
    rng,
    0,
    Math.floor(atLevel(ROT_FEEDER.hpBuff, rotFeeder.level) * 0.5),
  );
}

export function applyCorpsePeckerAccumulation(
  corpsePecker: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  // Self-sell: one-time bone_meal → approximate as ATK buff
  applyOneShotSellBuff(
    corpsePecker,
    team,
    night,
    rng,
    atLevel(CORPSE_PECKER.breadCrumbs, corpsePecker.level),
    0,
  );
}

export function applyBeggarAccumulation(beggar: UnitInstance, state: SimShopState): void {
  const ownedNights = sampleOwnedNights(beggar.tier as Tier, state.night, state.rng);
  if (ownedNights.length === 0) return;
  const extraBlood = sellBloodGain(beggar.level, beggar.id) - beggar.level;
  if (extraBlood <= 0) return;
  applyFoodPurchasesFromBlood(state, beggar.uid, extraBlood);
}
