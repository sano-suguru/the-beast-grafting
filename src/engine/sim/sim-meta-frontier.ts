import type { RegularUnitId } from "../../shared/types";
import type { MetaCandidate, MetaCandidateSource } from "./sim-types";
import type { DiscoveredArchetype } from "./sim-pair-synergy";
import { jaccardSimilarity } from "./sim-pair-synergy";
import { computeReachabilityScore } from "./sim-reachability";
import { estimateTeamViability } from "./sim-run-viability";

interface FrontierStats {
  readonly unitIds: readonly RegularUnitId[];
  readonly greedyRank: number | null;
  readonly gaFitness: number | null;
  readonly nightGaFitness: number | null;
  readonly reachabilityScore: number;
  readonly viabilityBaseSeed: number;
  readonly keyPair?: readonly [RegularUnitId, RegularUnitId];
}

interface FrontierSeed extends FrontierStats {
  readonly source: MetaCandidateSource;
}

type MutableFrontierStats = {
  -readonly [K in keyof FrontierStats]: FrontierStats[K];
};

interface FrontierOptions {
  readonly greedyArchetypes: readonly DiscoveredArchetype[];
  readonly gaTopTeams: readonly {
    readonly teamIds: readonly RegularUnitId[];
    readonly fitness: number;
    readonly adjustedFitness?: number;
  }[];
  readonly nightGaTopTeams: readonly {
    readonly teamIds: readonly RegularUnitId[];
    readonly fitness: number;
    readonly adjustedFitness?: number;
  }[];
  readonly night?: number;
  readonly maxGreedySeeds?: number;
  readonly maxGaSeeds?: number;
  readonly maxNightGaSeeds?: number;
  readonly maxCandidates?: number;
}

interface MutableFrontierCandidate {
  stats: MutableFrontierStats;
  sources: Set<MetaCandidateSource>;
}

function teamKey(ids: readonly RegularUnitId[]): string {
  return [...ids].sort().join(",");
}

function compareNullableNumberDesc(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function compareNullableNumberAsc(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function compareMetaCandidatePriority(a: MetaCandidate, b: MetaCandidate): number {
  return (
    b.viability.viabilityScore - a.viability.viabilityScore ||
    b.sources.length - a.sources.length ||
    compareNullableNumberDesc(a.nightGaFitness, b.nightGaFitness) ||
    compareNullableNumberDesc(a.gaFitness, b.gaFitness) ||
    compareNullableNumberAsc(a.greedyRank, b.greedyRank)
  );
}

function mergeSeed(map: Map<string, MutableFrontierCandidate>, seed: FrontierSeed): void {
  const key = teamKey(seed.unitIds);
  const existing = map.get(key);
  if (existing) {
    existing.sources.add(seed.source);
    if (seed.greedyRank !== null) {
      existing.stats.greedyRank =
        existing.stats.greedyRank === null
          ? seed.greedyRank
          : Math.min(existing.stats.greedyRank, seed.greedyRank);
    }
    if (seed.gaFitness !== null) {
      existing.stats.gaFitness =
        existing.stats.gaFitness === null
          ? seed.gaFitness
          : Math.max(existing.stats.gaFitness, seed.gaFitness);
    }
    if (seed.nightGaFitness !== null) {
      existing.stats.nightGaFitness =
        existing.stats.nightGaFitness === null
          ? seed.nightGaFitness
          : Math.max(existing.stats.nightGaFitness, seed.nightGaFitness);
    }
    existing.stats = {
      ...existing.stats,
      reachabilityScore: Math.max(existing.stats.reachabilityScore, seed.reachabilityScore),
    };
    return;
  }

  map.set(key, {
    stats: {
      unitIds: seed.unitIds,
      greedyRank: seed.greedyRank,
      gaFitness: seed.gaFitness,
      nightGaFitness: seed.nightGaFitness,
      reachabilityScore: seed.reachabilityScore,
      viabilityBaseSeed: seed.viabilityBaseSeed,
      ...(seed.keyPair ? { keyPair: seed.keyPair } : {}),
    },
    sources: new Set([seed.source]),
  });
}

function deduplicateMetaCandidates(
  candidates: readonly MetaCandidate[],
  maxCandidates: number,
): MetaCandidate[] {
  const sorted = [...candidates].sort(compareMetaCandidatePriority);
  const filtered: MetaCandidate[] = [];
  for (const candidate of sorted) {
    const isDuplicate = filtered.some(
      (existing) => jaccardSimilarity(existing.unitIds, candidate.unitIds) > 0.8,
    );
    if (!isDuplicate) {
      filtered.push(candidate);
      if (filtered.length >= maxCandidates) break;
    }
  }
  return filtered;
}

export function buildMetaCandidateFrontier({
  greedyArchetypes,
  gaTopTeams,
  nightGaTopTeams,
  maxGreedySeeds = 5,
  maxGaSeeds = 5,
  maxNightGaSeeds = 5,
  maxCandidates = 15,
  night = 12,
}: FrontierOptions): readonly MetaCandidate[] {
  const seeds = new Map<string, MutableFrontierCandidate>();

  greedyArchetypes.slice(0, maxGreedySeeds).forEach((arch, index) => {
    mergeSeed(seeds, {
      unitIds: arch.unitIds,
      source: "greedy",
      greedyRank: index + 1,
      gaFitness: null,
      nightGaFitness: null,
      reachabilityScore: arch.reachabilityScore,
      viabilityBaseSeed: (night + 1) * 50_000 + index,
      keyPair: arch.seedPair,
    });
  });

  gaTopTeams.slice(0, maxGaSeeds).forEach((team) => {
    mergeSeed(seeds, {
      unitIds: team.teamIds,
      source: "ga",
      greedyRank: null,
      gaFitness: team.adjustedFitness ?? team.fitness,
      nightGaFitness: null,
      reachabilityScore: computeReachabilityScore(team.teamIds, night),
      viabilityBaseSeed: (night + 1) * 60_000 + seeds.size,
    });
  });

  nightGaTopTeams.slice(0, maxNightGaSeeds).forEach((team) => {
    mergeSeed(seeds, {
      unitIds: team.teamIds,
      source: "night-ga",
      greedyRank: null,
      gaFitness: null,
      nightGaFitness: team.adjustedFitness ?? team.fitness,
      reachabilityScore: computeReachabilityScore(team.teamIds, night),
      viabilityBaseSeed: (night + 1) * 70_000 + seeds.size,
    });
  });

  const merged = [...seeds.values()].map<MetaCandidate>((candidate, index) => ({
    name: `meta-${index + 1}`,
    unitIds: candidate.stats.unitIds,
    sources: [...candidate.sources].sort(),
    greedyRank: candidate.stats.greedyRank,
    gaFitness: candidate.stats.gaFitness,
    nightGaFitness: candidate.stats.nightGaFitness,
    reachabilityScore: candidate.stats.reachabilityScore,
    viability: estimateTeamViability(
      candidate.stats.unitIds,
      night,
      candidate.stats.viabilityBaseSeed,
      {
        keyPair: candidate.stats.keyPair ?? null,
      },
    ),
  }));

  return deduplicateMetaCandidates(merged, maxCandidates).map((candidate, index) => ({
    ...candidate,
    name: `meta-${index + 1}`,
  }));
}
