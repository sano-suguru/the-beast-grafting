import type { DataUnitId } from "../../shared/types";
import type { UnitActionTally, UnitPerformance } from "./sim-types";
import { lookupUnitData } from "../../shared/data/unit-lookup";

interface MutablePerf {
  appearances: number;
  wins: number;
  totalDamage: number;
  totalDamageReceived: number;
  totalBuffAtk: number;
  totalBuffHp: number;
  totalBuffAtkGiven: number;
  totalBuffHpGiven: number;
  totalHealingDone: number;
  totalHealingReceived: number;
  totalKills: number;
  totalSpawnsProduced: number;
  survivalCount: number;
  totalSkillActivations: number;
  deathFrameSum: number;
  deathCount: number;
}

export type PerfMap = Map<DataUnitId, MutablePerf>;

/** 1戦闘分の UnitActionTally を DataUnitId 別に蓄積する（トークンはスキップ） */
export function accumulatePerformance(
  map: Map<DataUnitId, MutablePerf>,
  tally: UnitActionTally,
  won: boolean,
): void {
  if (tally.unitId === "token") return;
  const unitId: DataUnitId = tally.unitId;
  let p = map.get(unitId);
  if (!p) {
    p = {
      appearances: 0,
      wins: 0,
      totalDamage: 0,
      totalDamageReceived: 0,
      totalBuffAtk: 0,
      totalBuffHp: 0,
      totalBuffAtkGiven: 0,
      totalBuffHpGiven: 0,
      totalHealingDone: 0,
      totalHealingReceived: 0,
      totalKills: 0,
      totalSpawnsProduced: 0,
      survivalCount: 0,
      totalSkillActivations: 0,
      deathFrameSum: 0,
      deathCount: 0,
    };
    map.set(unitId, p);
  }
  p.appearances++;
  if (won) p.wins++;
  p.totalDamage += tally.damageDealt;
  p.totalDamageReceived += tally.damageReceived;
  p.totalBuffAtk += tally.buffAtk;
  p.totalBuffHp += tally.buffHp;
  p.totalBuffAtkGiven += tally.buffAtkGiven;
  p.totalBuffHpGiven += tally.buffHpGiven;
  p.totalHealingDone += tally.healingDone;
  p.totalHealingReceived += tally.healingReceived;
  p.totalKills += tally.kills;
  p.totalSpawnsProduced += tally.spawnsProduced;
  if (tally.survived) p.survivalCount++;
  p.totalSkillActivations += tally.skillCount;
  if (tally.deathFrame !== null) {
    p.deathFrameSum += tally.deathFrame;
    p.deathCount++;
  }
}

type BasePerf = Omit<UnitPerformance, "tierNormalizedWinRate">;

const avg = (total: number, n: number): number => (n > 0 ? total / n : 0);

function computeAverages(p: MutablePerf) {
  const n = p.appearances;
  return {
    n,
    avgDmg: avg(p.totalDamage, n),
    avgRecv: avg(p.totalDamageReceived, n),
    avgBa: avg(p.totalBuffAtk, n),
    avgBh: avg(p.totalBuffHp, n),
    avgBag: avg(p.totalBuffAtkGiven, n),
    avgBhg: avg(p.totalBuffHpGiven, n),
    avgHd: avg(p.totalHealingDone, n),
    avgHr: avg(p.totalHealingReceived, n),
    avgK: avg(p.totalKills, n),
    avgSp: avg(p.totalSpawnsProduced, n),
    sr: avg(p.survivalCount, n),
    adf: p.deathCount > 0 ? p.deathFrameSum / p.deathCount : null,
  };
}

function toBasePerf(id: DataUnitId, p: MutablePerf): BasePerf {
  const a = computeAverages(p);
  const tier = lookupUnitData(id)?.tier ?? 1;
  return {
    appearances: a.n,
    wins: p.wins,
    totalDamage: p.totalDamage,
    avgDamage: a.avgDmg,
    avgDamageReceived: a.avgRecv,
    avgBuffAtk: a.avgBa,
    avgBuffHp: a.avgBh,
    avgKills: a.avgK,
    avgSpawnsProduced: a.avgSp,
    avgBuffAtkGiven: a.avgBag,
    avgBuffHpGiven: a.avgBhg,
    avgHealingDone: a.avgHd,
    avgHealingReceived: a.avgHr,
    survivalRate: a.sr,
    avgDeathFrame: a.adf,
    totalSkillActivations: p.totalSkillActivations,
    tier,
    impactScore: a.avgDmg + a.avgBag + a.avgBhg + a.avgK * 3 + a.avgSp * 2,
    winRateCI95: wilsonCI(p.wins, a.n),
  };
}

/** MutablePerf マップを読み取り専用の UnitPerformance マップに変換 */
export function finalizePerformance(
  map: ReadonlyMap<DataUnitId, MutablePerf>,
): ReadonlyMap<DataUnitId, UnitPerformance> {
  const base = new Map<DataUnitId, BasePerf>();
  for (const [id, p] of map) base.set(id, toBasePerf(id, p));
  return applyTierNormalization(base);
}

function applyTierNormalization(
  base: ReadonlyMap<DataUnitId, BasePerf>,
): ReadonlyMap<DataUnitId, UnitPerformance> {
  const tierWinSums = new Map<number, { total: number; count: number }>();
  for (const perf of base.values()) {
    const entry = tierWinSums.get(perf.tier) ?? { total: 0, count: 0 };
    entry.total += perf.appearances > 0 ? perf.wins / perf.appearances : 0;
    entry.count++;
    tierWinSums.set(perf.tier, entry);
  }
  const tierAvg = new Map<number, number>();
  for (const [t, { total, count }] of tierWinSums) {
    tierAvg.set(t, count > 0 ? total / count : 0);
  }
  const result = new Map<DataUnitId, UnitPerformance>();
  for (const [id, perf] of base) {
    const wr = perf.appearances > 0 ? perf.wins / perf.appearances : 0;
    result.set(id, { ...perf, tierNormalizedWinRate: wr - (tierAvg.get(perf.tier) ?? 0) });
  }
  return result;
}

/** Wilson score interval for binomial proportion (95% CI, z=1.96) */
export function wilsonCI(successes: number, n: number): readonly [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96;
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]!;
}
