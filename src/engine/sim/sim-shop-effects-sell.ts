import type { UnitInstance } from "../../shared/types";
import type { Tier } from "../../shared/data/tiers";
import type { Rng } from "../rng";
import { atLevel, type Buff } from "../../shared/skill-params";
import {
  ASH_FUNGUS,
  CORPSE_BROKER,
  GRAVE_WORM,
  MARKET_VULTURE,
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

function applyTeamBuffFromSells(
  unit: UnitInstance,
  buff: Buff,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  const nights = activeNights(unit.tier as Tier, night);
  if (nights <= 0) return;
  const rawSells = totalWeightedSells(unit.tier as Tier, night);
  const totalAtk = Math.floor(buff.atk * rawSells);
  const totalHp = Math.floor(buff.hp * rawSells);
  distributeBuffRandomly(team, totalAtk, totalHp, rng);
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

export function applyGraveWormAccumulation(
  worm: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  applyTeamBuffFromSells(worm, atLevel(GRAVE_WORM.sellBuff, worm.level), team, night, rng);
}

/**
 * market_vulture: selfBuff（売却時に自身バフ）+ shopBuff（売却時にショップにバフ）を近似。
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
  applySelfBuffFromSells(vulture, atLevel(MARKET_VULTURE.selfBuff, vulture.level), night);

  const nights = activeNights(vulture.tier as Tier, night);
  if (nights <= 0) return;
  const rawSells = totalWeightedSells(vulture.tier as Tier, night);
  const shopBuff = atLevel(MARKET_VULTURE.shopBuff, vulture.level);
  const totalAtk = Math.floor(shopBuff.atk * rawSells * 0.5);
  const totalHp = Math.floor(shopBuff.hp * rawSells * 0.5);
  distributeBuffRandomly(team, totalAtk, totalHp, rng);
}
