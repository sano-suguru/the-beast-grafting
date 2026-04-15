import type { RegularUnitId } from "../../shared/types";

export interface GaConfig {
  readonly populationSize: number;
  readonly generations: number;
  readonly trialsPerEval: number;
  readonly eliteCount: number;
  readonly mutationRate: number;
  readonly tournamentSize: number;
  readonly refinementTrials: number;
  readonly refinementTopK: number;
  readonly night: number;
  readonly baseSeed: number;
}

export interface GaIndividual {
  teamIds: RegularUnitId[];
  fitness: number;
}

export interface GaGenerationStats {
  readonly generation: number;
  readonly bestFitness: number;
  readonly avgFitness: number;
  readonly diversity: number;
}

export interface GaRankedTeam {
  readonly teamIds: readonly RegularUnitId[];
  readonly fitness: number;
  readonly fitnessCI95: readonly [number, number];
  readonly novelty: boolean;
}

export interface GaResult {
  readonly topTeams: readonly GaRankedTeam[];
  readonly generationStats: readonly GaGenerationStats[];
  readonly totalBattles: number;
  readonly config: GaConfig;
}
