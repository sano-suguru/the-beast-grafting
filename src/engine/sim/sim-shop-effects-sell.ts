import type { UnitInstance } from "../../shared/types";
import type { Tier } from "../../shared/data/tiers";
import type { Rng } from "../rng";
import { atLevel } from "../../shared/skill-params";
import { BONE_JAW, CORPSE_BROKER, CORPSE_PECKER, ROT_FEEDER } from "../../shared/skill-params-shop";
import { activeNights, distributeBuffRandomly } from "./sim-shop-effects-util";

export function applyCorpseBrokerAccumulation(
  broker: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  const nights = activeNights(broker.tier as Tier, night);
  if (nights <= 0) return;

  const hpBuff = atLevel(CORPSE_BROKER.hpBuff, broker.level);
  const maxUses = CORPSE_BROKER.maxUses;

  // maxUses はユニット生存中の総使用上限(shop-effects-dose.ts 参照)。
  // 投与機会はアイテム購入頻度に近似(平均 0.5回/夜)するが、総量は maxUses で打ち切る。
  const dosesPerNight = 0.5;
  const totalDoses = Math.min(Math.floor(dosesPerNight * nights), maxUses);
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
  if (activeNights(boneJaw.tier as Tier, night) <= 0) return;
  // Self-sell: one-time ATK buff to allies when sold
  const atkBuff = atLevel(BONE_JAW.atkBuff, boneJaw.level);
  distributeBuffRandomly(team, atkBuff * BONE_JAW.targets, 0, rng);
}

export function applyRotFeederAccumulation(
  rotFeeder: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  if (activeNights(rotFeeder.tier as Tier, night) <= 0) return;
  // Self-sell: one-time shop HP buff → approximate as 50% team HP buff
  const hp = Math.floor(atLevel(ROT_FEEDER.hpBuff, rotFeeder.level) * 0.5);
  if (hp > 0) distributeBuffRandomly(team, 0, hp, rng);
}

export function applyCorpsePeckerAccumulation(
  corpsePecker: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  if (activeNights(corpsePecker.tier as Tier, night) <= 0) return;
  // Self-sell: one-time bone_meal → approximate as ATK buff
  const atk = atLevel(CORPSE_PECKER.breadCrumbs, corpsePecker.level);
  if (atk > 0) distributeBuffRandomly(team, atk, 0, rng);
}
