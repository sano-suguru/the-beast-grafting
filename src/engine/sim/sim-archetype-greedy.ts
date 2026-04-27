import type { RegularUnitId } from "../../shared/types";
import type { UnitPerformance } from "./sim-types";
import { TEAM_SIZE } from "./sim-types";
import {
  type DiscoveredArchetype,
  type PairSynergy,
  jaccardSimilarity,
  pairKey,
} from "./sim-pair-synergy";
import { computeReachabilityScore } from "./sim-reachability";
import { estimateTeamViability } from "./sim-run-viability";

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

const SYNERGY_WEIGHT = 0.4;
const ABS_WR_WEIGHT = 0.2;
const REACHABILITY_WEIGHT = 0.15;
const VIABILITY_WEIGHT = 0.25;
const MIN_MEMBER_WIN_RATE = 0.32;
const MIN_REACHABILITY = 0.05;
const MIN_CORRELATED_REACHABILITY = 0.02;

function avgWinRate(
  team: readonly RegularUnitId[],
  unitPerformance: ReadonlyMap<RegularUnitId, UnitPerformance>,
): number {
  let totalWR = 0;
  let count = 0;
  for (const id of team) {
    const perf = unitPerformance.get(id);
    if (perf && perf.appearances > 0) {
      totalWR += perf.wins / perf.appearances;
      count++;
    }
  }
  return count > 0 ? totalWR / count : 0;
}

function compositeScore(c: DiscoveredArchetype): number {
  const synergy = c.totalSynergyDelta;
  const absWR = c.avgMemberWR ?? 0.5;
  return (
    synergy * SYNERGY_WEIGHT +
    absWR * ABS_WR_WEIGHT +
    c.reachabilityScore * REACHABILITY_WEIGHT +
    c.viability.viabilityScore * VIABILITY_WEIGHT
  );
}

function tryBuildCandidate(
  seed: PairSynergy,
  unitPool: readonly RegularUnitId[],
  pairMap: PairMap,
  unitPerformance: ReadonlyMap<RegularUnitId, UnitPerformance> | undefined,
  night: number,
  index: number,
): DiscoveredArchetype | null {
  const team = greedyFillTeam([seed.unitA, seed.unitB], unitPool, pairMap);
  if (team.length < TEAM_SIZE) return null;
  const totalSynergyDelta = computeTotalDelta(team, pairMap);
  const avgMemberWR = unitPerformance ? avgWinRate(team, unitPerformance) : null;
  if (avgMemberWR !== null && avgMemberWR < MIN_MEMBER_WIN_RATE) return null;
  const reachabilityScore = computeReachabilityScore(team, night);
  if (reachabilityScore < MIN_REACHABILITY) return null;
  const viability = estimateTeamViability(team, night, (night + 1) * 10_000 + index, {
    keyPair: [seed.unitA, seed.unitB],
  });
  if (viability.correlatedReachabilityScore < MIN_CORRELATED_REACHABILITY) return null;
  return {
    name: `comp-${index + 1}`,
    unitIds: team,
    seedPair: [seed.unitA, seed.unitB],
    totalSynergyDelta,
    avgMemberWR,
    reachabilityScore,
    viability,
  };
}

function registerCandidate(
  candidate: DiscoveredArchetype,
  candidateMap: Map<string, DiscoveredArchetype>,
  diverseCandidates: DiscoveredArchetype[],
): void {
  const teamKey = [...candidate.unitIds].sort().join(",");
  const existing = candidateMap.get(teamKey);
  if (!existing || compositeScore(candidate) > compositeScore(existing)) {
    candidateMap.set(teamKey, candidate);
  }
  const isDuplicate = diverseCandidates.some(
    (existingCandidate) => jaccardSimilarity(existingCandidate.unitIds, candidate.unitIds) > 0.6,
  );
  if (!isDuplicate) diverseCandidates.push(candidate);
}

function hasEnoughCandidates(
  candidateMap: ReadonlyMap<string, DiscoveredArchetype>,
  diverseCandidates: readonly DiscoveredArchetype[],
  maxCompositions: number,
): boolean {
  return candidateMap.size >= maxCompositions * 4 && diverseCandidates.length >= maxCompositions;
}

export function discoverArchetypes(
  pairSynergies: readonly PairSynergy[],
  unitPerformance?: ReadonlyMap<RegularUnitId, UnitPerformance>,
  maxCompositions = 10,
  night = 12,
): readonly DiscoveredArchetype[] {
  const pairMap = buildPairMap(pairSynergies);
  const unitPool = collectUnitPool(pairSynergies);
  const candidateMap = new Map<string, DiscoveredArchetype>();
  const diverseCandidates: DiscoveredArchetype[] = [];

  for (const [pairIndex, seed] of pairSynergies.entries()) {
    if (seed.ciLower <= 0) continue;
    const candidate = tryBuildCandidate(seed, unitPool, pairMap, unitPerformance, night, pairIndex);
    if (!candidate) continue;
    registerCandidate(candidate, candidateMap, diverseCandidates);
    if (hasEnoughCandidates(candidateMap, diverseCandidates, maxCompositions)) break;
  }

  const candidates = [...candidateMap.values()];
  candidates.sort((a, b) => compositeScore(b) - compositeScore(a));
  const filtered = deduplicateByJaccard(candidates, maxCompositions);
  return filtered.map((c, i) => ({ ...c, name: `comp-${i + 1}` }));
}
