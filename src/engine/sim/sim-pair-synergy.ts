import type { RegularUnitId } from "../../shared/types";
import type { TeamTrial, TeamViability, UnitPerformance } from "./sim-types";
import { wilsonCI } from "./sim-perf";

export interface PairSynergy {
  readonly unitA: RegularUnitId;
  readonly unitB: RegularUnitId;
  readonly coWinRate: number;
  readonly expectedWinRate: number;
  readonly synergyDelta: number;
  readonly sampleCount: number;
  readonly ciLower: number;
  readonly ciUpper: number;
}

export interface DiscoveredArchetype {
  readonly name: string;
  readonly unitIds: readonly RegularUnitId[];
  readonly seedPair: readonly [RegularUnitId, RegularUnitId];
  readonly totalSynergyDelta: number;
  readonly avgMemberWR: number | null;
  readonly reachabilityScore: number;
  readonly viability: TeamViability;
}

const MIN_PAIR_SAMPLES = 30;

export function pairKey(a: RegularUnitId, b: RegularUnitId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

interface PairEntry {
  wins: number;
  count: number;
  readonly unitA: RegularUnitId;
  readonly unitB: RegularUnitId;
}

type PairStatsMap = Map<string, PairEntry>;

function collectPairStats(teamTrials: readonly TeamTrial[]): PairStatsMap {
  const pairs: PairStatsMap = new Map();

  for (const trial of teamTrials) {
    const ids = trial.teamIds;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = pairKey(ids[i]!, ids[j]!);
        let entry = pairs.get(key);
        if (!entry) {
          const [a, b] = ids[i]! < ids[j]! ? [ids[i]!, ids[j]!] : [ids[j]!, ids[i]!];
          entry = { wins: 0, count: 0, unitA: a, unitB: b };
          pairs.set(key, entry);
        }
        entry.count++;
        if (trial.won) entry.wins++;
      }
    }
  }

  return pairs;
}

function computePairSynergy(
  entry: PairEntry,
  unitPerformance: ReadonlyMap<RegularUnitId, UnitPerformance>,
  overallWinRate: number,
): PairSynergy | null {
  if (entry.count < MIN_PAIR_SAMPLES) return null;

  const perfA = unitPerformance.get(entry.unitA);
  const perfB = unitPerformance.get(entry.unitB);
  if (!perfA || !perfB) return null;

  const coWinRate = entry.wins / entry.count;
  const wA = perfA.wins / perfA.appearances;
  const wB = perfB.wins / perfB.appearances;
  // 加法独立モデル: 各ユニットの基準超過分が独立に加算される前提
  const expectedWinRate = Math.max(0, Math.min(1, wA + wB - overallWinRate));

  // coWinRate の標本誤差のみ反映。expectedWinRate は十分大きい個別標本から
  // 算出されるため定数扱いする（個別N >> ペアN の前提）
  const [coLower, coUpper] = wilsonCI(entry.wins, entry.count);

  return {
    unitA: entry.unitA,
    unitB: entry.unitB,
    coWinRate,
    expectedWinRate,
    synergyDelta: coWinRate - expectedWinRate,
    sampleCount: entry.count,
    ciLower: coLower - expectedWinRate,
    ciUpper: coUpper - expectedWinRate,
  };
}

export function analyzePairSynergies(
  teamTrials: readonly TeamTrial[],
  unitPerformance: ReadonlyMap<RegularUnitId, UnitPerformance>,
  overallWinRate: number,
): readonly PairSynergy[] {
  const pairs = collectPairStats(teamTrials);
  const results: PairSynergy[] = [];

  for (const entry of pairs.values()) {
    const synergy = computePairSynergy(entry, unitPerformance, overallWinRate);
    if (synergy) results.push(synergy);
  }

  results.sort((a, b) => b.ciLower - a.ciLower);
  return results;
}

export function jaccardSimilarity(
  a: readonly RegularUnitId[],
  b: readonly RegularUnitId[],
): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const id of setA) {
    if (setB.has(id)) intersection++;
  }
  const unionSize = setA.size + setB.size - intersection;
  if (unionSize === 0) return 1;
  return intersection / unionSize;
}
