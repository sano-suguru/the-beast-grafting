import type { UnitInstance } from "../../shared/types";
import type { Tier } from "../../shared/data/tiers";
import type { Rng } from "../rng";

import { atLevel, type Buff } from "../../shared/skill-params";
import {
  BONE_TREE,
  GHOUL_INFANT,
  ASH_FUNGUS,
  CORPSE_BROKER,
  GRAVE_WORM,
  MARKET_VULTURE,
} from "../../shared/skill-params-shop";

/**
 * ゲーム経済モデルに基づくショップスキル累積効果の近似。
 *
 * 実ゲームではプレイヤーの購入・売却のたびにショップスキルが発動するが、
 * simではショップフェーズを再現しない。代わりにゲーム経済定数
 * （Blood=10, UNIT_COST=3, Tier出現スケジュール）から
 * 「各ナイトで何回の購入/売却が発生するか」を統計的に推定し、
 * チーム構成に応じた累積効果を適用する。
 *
 * 対象: bone_tree, ghoul_infant, ash_fungus, corpse_broker
 */

/**
 * ナイトあたりの購入・売却回数（ゲーム経済から導出）。
 *
 * 10 blood の配分:
 * - ロール: 2-3回 (2-3 blood) — 高Tier Nightほどロール多い
 * - ユニット購入: 1-2回 (3-6 blood) — UNIT_COST=3
 * - アイテム購入: 0-1回 (3-5 blood)
 * - 売却収入: +1-2 blood（Night 3以降）
 *
 * ユニット入手初Nightは途中からの発動（ショップスキル持ちを先に買うとは限らない）。
 */
const PURCHASES_PER_NIGHT = 0.6; // 高Nightほどロール多、アイテム購入あり、接合あり
const SELLS_PER_NIGHT_LATE = 0.6; // Night 4以降の平均売却回数
const SELL_START_NIGHT = 4; // 売却が始まるNight（盤面が埋まり始める）

/** 入手初Night は途中からの発動。以降は完全に発動。 */
const FIRST_NIGHT_FRACTION = 0.5;

/** Tier → 最速出現Night */
const TIER_APPEAR_NIGHT: Record<Tier, number> = {
  1: 1,
  2: 3,
  3: 5,
  4: 7,
  5: 9,
  6: 11,
};

/** ナイトあたりの購入・売却回数を推定 */
function estimateNightActions(
  night: number,
  isFirstActiveNight: boolean,
): { purchases: number; sells: number } {
  const fraction = isFirstActiveNight ? FIRST_NIGHT_FRACTION : 1.0;
  const purchases = PURCHASES_PER_NIGHT * fraction;
  const sells = night >= SELL_START_NIGHT ? SELLS_PER_NIGHT_LATE * fraction : 0;
  return { purchases, sells };
}

/** Night N のショッププール内ユニットの平均Tier（実データ） */

/** Night N の平均的な売却ユニットの合計スタッツ（baseAtk+baseHp + progression） */
function avgSoldUnitTotalStats(night: number): number {
  // 売却されるのは低Tierの古いユニット。base合計≈5 + night由来のバフ
  return 5 + Math.floor(night * 0.5);
}

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
        applyMarketVultureAccumulation(unit, night);
        break;
    }
  }
}

function activeNights(tier: Tier, battleNight: number): number {
  return Math.max(0, battleNight - TIER_APPEAR_NIGHT[tier] + 1);
}

function applyBoneTreeAccumulation(
  boneTree: UnitInstance,
  team: UnitInstance[],
  night: number,
): void {
  const nights = activeNights(boneTree.tier as Tier, night);
  if (nights <= 0) return;

  const buff = atLevel(BONE_TREE.buff, boneTree.level);
  let rawAtk = 0;
  let rawHp = 0;

  const appearNight = TIER_APPEAR_NIGHT[boneTree.tier as Tier];
  for (let n = appearNight; n <= night; n++) {
    const { purchases } = estimateNightActions(n, n === appearNight);
    rawAtk += buff.atk * purchases;
    rawHp += buff.hp * purchases;
  }

  const totalAtk = Math.floor(rawAtk);
  const totalHp = Math.floor(rawHp);
  for (const u of team) {
    u.buffAtk += totalAtk;
    u.buffHp += totalHp;
  }
}

function estimateTotalPurchases(tier: Tier, night: number): number {
  const appearNight = TIER_APPEAR_NIGHT[tier];
  let total = 0;
  for (let n = appearNight; n <= night; n++) {
    total += estimateNightActions(n, n === appearNight).purchases;
  }
  return total;
}

function applyGhoulInfantAccumulation(
  ghoulInfant: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  const nights = activeNights(ghoulInfant.tier as Tier, night);
  if (nights <= 0) return;

  const atkBuff = atLevel(GHOUL_INFANT.atkBuff, ghoulInfant.level);
  const rawTriggers = estimateTotalPurchases(ghoulInfant.tier as Tier, night);
  const totalAtk = Math.floor(atkBuff * rawTriggers);
  distributeBuffRandomly(team, totalAtk, 0, rng);
}

function applyAshFungusAccumulation(
  ashFungus: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  const nights = activeNights(ashFungus.tier as Tier, night);
  if (nights <= 0) return;

  const percent = atLevel(ASH_FUNGUS.percent, ashFungus.level);
  let rawBuff = 0;

  const appearNight = TIER_APPEAR_NIGHT[ashFungus.tier as Tier];
  for (let n = appearNight; n <= night; n++) {
    const { sells } = estimateNightActions(n, n === appearNight);
    const avgStats = avgSoldUnitTotalStats(n);
    rawBuff += avgStats * (percent / 100) * sells;
  }

  const totalBuff = Math.floor(rawBuff);
  if (totalBuff <= 0) return;
  const half = Math.floor(totalBuff / 2);
  distributeBuffRandomly(team, totalBuff - half, half, rng);
}

function estimateTotalSells(tier: Tier, night: number): number {
  const appearNight = TIER_APPEAR_NIGHT[tier];
  let total = 0;
  for (let n = appearNight; n <= night; n++) {
    total += estimateNightActions(n, n === appearNight).sells;
  }
  return total;
}

function applySelfBuffFromSells(unit: UnitInstance, buff: Buff, night: number): void {
  const nights = activeNights(unit.tier as Tier, night);
  if (nights <= 0) return;
  const rawSells = estimateTotalSells(unit.tier as Tier, night);
  unit.buffAtk += Math.floor(buff.atk * rawSells);
  unit.buffHp += Math.floor(buff.hp * rawSells);
}

function applyCorpseBrokerAccumulation(broker: UnitInstance, night: number): void {
  applySelfBuffFromSells(broker, atLevel(CORPSE_BROKER.sellBuff, broker.level), night);
}

/** ランダムに味方1体ずつバフを分配（合計値を等分） */
function distributeBuffRandomly(team: UnitInstance[], atk: number, hp: number, rng: Rng): void {
  if (team.length === 0) return;
  // 合計バフを均等に分配（simの大数回試行で期待値に収束するためランダム配分は簡易化）
  const perUnitAtk = Math.floor(atk / team.length);
  const perUnitHp = Math.floor(hp / team.length);
  for (const u of team) {
    u.buffAtk += perUnitAtk;
    u.buffHp += perUnitHp;
  }
  // 端数は乱数で1体に付与
  const remainder = { atk: atk - perUnitAtk * team.length, hp: hp - perUnitHp * team.length };
  if (remainder.atk > 0 || remainder.hp > 0) {
    const target = team[Math.floor(rng.next() * team.length)]!;
    target.buffAtk += remainder.atk;
    target.buffHp += remainder.hp;
  }
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
  const rawSells = estimateTotalSells(unit.tier as Tier, night);
  const totalAtk = Math.floor(buff.atk * rawSells);
  const totalHp = Math.floor(buff.hp * rawSells);
  distributeBuffRandomly(team, totalAtk, totalHp, rng);
}

function applyGraveWormAccumulation(
  worm: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  applyTeamBuffFromSells(worm, atLevel(GRAVE_WORM.sellBuff, worm.level), team, night, rng);
}

function applyMarketVultureAccumulation(vulture: UnitInstance, night: number): void {
  applySelfBuffFromSells(vulture, atLevel(MARKET_VULTURE.selfBuff, vulture.level), night);
}
