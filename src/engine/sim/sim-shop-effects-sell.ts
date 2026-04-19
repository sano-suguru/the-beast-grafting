import type { UnitInstance } from "../../shared/types";
import type { Tier } from "../../shared/data/tiers";
import type { Rng } from "../rng";
import { atLevel, type Buff } from "../../shared/skill-params";
import {
  ASH_FUNGUS,
  BONE_JAW,
  CORPSE_BROKER,
  CORPSE_PECKER,
  MARKET_VULTURE,
  ROT_FEEDER,
} from "../../shared/skill-params-shop";
import {
  activeNights,
  estimateWeightedActions,
  distributeBuffRandomly,
} from "./sim-shop-effects-util";

/** Night N の平均的な売却ユニットの合計スタッツ（baseAtk+baseHp + progression） */
function avgSoldUnitTotalStats(night: number): number {
  return 5 + Math.floor(night * 0.5);
}

function totalWeightedSells(tier: Tier, night: number): number {
  let total = 0;
  for (const action of estimateWeightedActions(tier, night)) {
    total += action.sells;
  }
  return total;
}

function applySelfBuffFromSells(unit: UnitInstance, buff: Buff, night: number): void {
  const nights = activeNights(unit.tier as Tier, night);
  if (nights <= 0) return;
  const rawSells = totalWeightedSells(unit.tier as Tier, night);
  unit.buffAtk += Math.floor(buff.atk * rawSells);
  unit.buffHp += Math.floor(buff.hp * rawSells);
}

export function applyAshFungusAccumulation(
  ashFungus: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  const nights = activeNights(ashFungus.tier as Tier, night);
  if (nights <= 0) return;

  const percent = atLevel(ASH_FUNGUS.percent, ashFungus.level);
  let rawBuff = 0;

  for (const action of estimateWeightedActions(ashFungus.tier as Tier, night)) {
    const avgStats = avgSoldUnitTotalStats(action.night);
    rawBuff += avgStats * (percent / 100) * action.sells;
  }

  const totalBuff = Math.floor(rawBuff);
  if (totalBuff <= 0) return;
  const half = Math.floor(totalBuff / 2);
  distributeBuffRandomly(team, totalBuff - half, half, rng);
}

export function applyCorpseBrokerAccumulation(broker: UnitInstance, night: number): void {
  applySelfBuffFromSells(broker, atLevel(CORPSE_BROKER.sellBuff, broker.level), night);
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

/**
 * market_vulture: shopBuff（売却時にショップにバフ）を近似。
 *
 * shopBuff は本来ショップ内ユニットに付与→購入でチーム合流。vulture 自身を含む全体分配で近似。
 * 売却後に購入が続く確率を 0.5 と推定。
 */
export function applyMarketVultureAccumulation(
  vulture: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  const nights = activeNights(vulture.tier as Tier, night);
  if (nights <= 0) return;
  const rawSells = totalWeightedSells(vulture.tier as Tier, night);
  const shopBuff = atLevel(MARKET_VULTURE.shopBuff, vulture.level);
  const totalAtk = Math.floor(shopBuff.atk * rawSells * 0.5);
  const totalHp = Math.floor(shopBuff.hp * rawSells * 0.5);
  distributeBuffRandomly(team, totalAtk, totalHp, rng);
}
