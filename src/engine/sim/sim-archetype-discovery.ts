import type { RegularUnitId } from "../../shared/types";
import type { TeamTrial, UnitPerformance } from "./sim-types";
import { TEAM_SIZE } from "./sim-types";
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
}

const MIN_PAIR_SAMPLES = 30;

function pairKey(a: RegularUnitId, b: RegularUnitId): string {
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

/**
 * Layer 2: チーム構成データからペアシナジーを算出する。
 *
 * 各ペアの共起勝率と、個体勝率から推定される期待勝率との差分で
 * シナジー強度を測定する。
 */
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

function jaccardSimilarity(a: readonly RegularUnitId[], b: readonly RegularUnitId[]): number {
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

// ── Layer 3: Greedy composition discovery ──

type PairMap = ReadonlyMap<string, number>;

function buildPairMap(pairSynergies: readonly PairSynergy[]): PairMap {
  const map = new Map<string, number>();
  for (const ps of pairSynergies) {
    map.set(pairKey(ps.unitA, ps.unitB), ps.synergyDelta);
  }
  return map;
}

function collectUnitPool(pairSynergies: readonly PairSynergy[]): RegularUnitId[] {
  const allUnits = new Set<RegularUnitId>();
  for (const ps of pairSynergies) {
    allUnits.add(ps.unitA);
    allUnits.add(ps.unitB);
  }
  return [...allUnits];
}

function greedyFillTeam(
  seed: readonly [RegularUnitId, RegularUnitId],
  unitPool: readonly RegularUnitId[],
  pairMap: PairMap,
): RegularUnitId[] {
  const team: RegularUnitId[] = [...seed];
  for (let slot = team.length; slot < TEAM_SIZE; slot++) {
    const best = pickBestCandidate(team, unitPool, pairMap);
    if (best) team.push(best);
  }
  return team;
}

function pickBestCandidate(
  team: readonly RegularUnitId[],
  unitPool: readonly RegularUnitId[],
  pairMap: PairMap,
): RegularUnitId | null {
  let bestUnit: RegularUnitId | null = null;
  let bestScore = -Infinity;
  for (const candidate of unitPool) {
    if (team.includes(candidate)) continue;
    let score = 0;
    for (const member of team) {
      score += pairMap.get(pairKey(candidate, member)) ?? 0;
    }
    if (score > bestScore) {
      bestScore = score;
      bestUnit = candidate;
    }
  }
  return bestUnit;
}

function computeTotalDelta(team: readonly RegularUnitId[], pairMap: PairMap): number {
  let total = 0;
  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      total += pairMap.get(pairKey(team[i]!, team[j]!)) ?? 0;
    }
  }
  return total;
}

function deduplicateByJaccard(
  candidates: readonly DiscoveredArchetype[],
  maxCount: number,
): DiscoveredArchetype[] {
  const filtered: DiscoveredArchetype[] = [];
  for (const c of candidates) {
    const isDuplicate = filtered.some((f) => jaccardSimilarity(f.unitIds, c.unitIds) > 0.6);
    if (!isDuplicate) {
      filtered.push(c);
      if (filtered.length >= maxCount) break;
    }
  }
  return filtered;
}

/**
 * Layer 3: ペアシナジー上位から5体構成をグリーディに構築する。
 *
 * 「正しいアーキタイプ」ではなく「データが示す最強候補」。
 */
export function discoverArchetypes(
  pairSynergies: readonly PairSynergy[],
  maxCompositions = 10,
): readonly DiscoveredArchetype[] {
  const pairMap = buildPairMap(pairSynergies);
  const unitPool = collectUnitPool(pairSynergies);
  const candidates: DiscoveredArchetype[] = [];

  for (const seed of pairSynergies) {
    if (seed.ciLower <= 0) continue;
    const team = greedyFillTeam([seed.unitA, seed.unitB], unitPool, pairMap);
    if (team.length < TEAM_SIZE) continue;

    candidates.push({
      name: `comp-${candidates.length + 1}`,
      unitIds: team,
      seedPair: [seed.unitA, seed.unitB],
      totalSynergyDelta: computeTotalDelta(team, pairMap),
    });

    if (candidates.length >= maxCompositions * 3) break;
  }

  candidates.sort((a, b) => b.totalSynergyDelta - a.totalSynergyDelta);
  const filtered = deduplicateByJaccard(candidates, maxCompositions);
  return filtered.map((c, i) => ({ ...c, name: `comp-${i + 1}` }));
}
