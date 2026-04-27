import { Worker } from "node:worker_threads";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import type { RegularUnitId } from "../../shared/types";
import type { Rng } from "../rng";
import type {
  GaConfig,
  GaGenerationStats,
  GaIndividual,
  GaRankedTeam,
  GaResult,
  WorkerResult,
  WorkerTask,
} from "./sim-ga-types";
import { createSeededRng } from "../rng";
import { getShopPool } from "../helpers";
import { generateSimTeam } from "./sim-team-gen";
import { adjustFitnessForViability, estimateTeamViability } from "./sim-run-viability";
import { deriveSeed } from "./sim-utils";
import { wilsonCI } from "./sim-perf";
import { TEAM_SIZE } from "./sim-types";

function getUniquePool(night: number): RegularUnitId[] {
  return [...new Set(getShopPool(night))];
}

// ── Worker Pool ──

export function createGaWorkerPool(count?: number): Worker[] {
  const n = count ?? Math.max(1, availableParallelism() - 1);
  const workerPath = fileURLToPath(new URL("./sim-ga-worker-boot.cjs", import.meta.url).toString());
  return Array.from({ length: n }, () => new Worker(workerPath));
}

export function terminateGaWorkerPool(workers: Worker[]): void {
  for (const w of workers) void w.terminate();
}

// ── Parallel Batch Evaluation ──

async function evaluateBatch(
  teams: readonly (readonly RegularUnitId[])[],
  night: number,
  trialCount: number,
  trialBaseSeed: number,
  workers: Worker[],
): Promise<WorkerResult> {
  if (teams.length === 0) return { winRates: [], battles: 0 };

  const chunkSize = Math.ceil(teams.length / workers.length);
  const chunks: (readonly RegularUnitId[])[][] = [];
  for (let i = 0; i < teams.length; i += chunkSize) {
    chunks.push(teams.slice(i, i + chunkSize));
  }

  const promises = chunks.map(
    (chunk, i) =>
      new Promise<WorkerResult>((resolve, reject) => {
        const w = workers[i]!;
        const onMsg = (r: WorkerResult) => {
          w.removeListener("error", onErr);
          resolve(r);
        };
        const onErr = (err: Error) => {
          w.removeListener("message", onMsg);
          reject(err);
        };
        w.once("message", onMsg);
        w.once("error", onErr);
        w.postMessage({ teams: chunk, night, trialCount, trialBaseSeed } satisfies WorkerTask);
      }),
  );

  const results = await Promise.all(promises);
  const winRates: number[] = [];
  let totalBattles = 0;
  for (const r of results) {
    winRates.push(...r.winRates);
    totalBattles += r.battles;
  }
  return { winRates, battles: totalBattles };
}

// ── Population Initialization ──

function initPopulation(size: number, night: number, baseSeed: number): GaIndividual[] {
  const pop: GaIndividual[] = [];
  for (let i = 0; i < size; i++) {
    const rng = createSeededRng(deriveSeed(baseSeed, i));
    pop.push({ teamIds: generateSimTeam(night, rng), fitness: 0 });
  }
  return pop;
}

// ── Selection ──

function tournamentSelect(
  pop: readonly GaIndividual[],
  tournamentSize: number,
  rng: Rng,
): GaIndividual {
  let best: GaIndividual = pop[Math.floor(rng.next() * pop.length)]!;
  for (let i = 1; i < tournamentSize; i++) {
    const candidate = pop[Math.floor(rng.next() * pop.length)]!;
    if (candidate.fitness > best.fitness) best = candidate;
  }
  return best;
}

// ── Crossover ──

function tryAdd(child: RegularUnitId[], used: Set<RegularUnitId>, id: RegularUnitId): void {
  if (child.length < TEAM_SIZE && !used.has(id)) {
    child.push(id);
    used.add(id);
  }
}

function fillFromSource(
  child: RegularUnitId[],
  used: Set<RegularUnitId>,
  source: readonly RegularUnitId[],
): void {
  for (const id of source) {
    if (child.length >= TEAM_SIZE) break;
    tryAdd(child, used, id);
  }
}

function crossover(
  parentA: readonly RegularUnitId[],
  parentB: readonly RegularUnitId[],
  pool: readonly RegularUnitId[],
  rng: Rng,
): RegularUnitId[] {
  const child: RegularUnitId[] = [];
  const used = new Set<RegularUnitId>();

  for (const id of parentA) {
    if (rng.next() < 0.5) tryAdd(child, used, id);
  }
  fillFromSource(child, used, parentB);
  fillFromSource(child, used, parentA);
  if (child.length < TEAM_SIZE) {
    fillFromSource(
      child,
      used,
      pool.filter((id) => !used.has(id)),
    );
  }
  return child;
}

// ── Mutation ──

function mutate(
  team: RegularUnitId[],
  pool: readonly RegularUnitId[],
  rate: number,
  rng: Rng,
): RegularUnitId[] {
  const result = [...team];
  const used = new Set(result);
  for (let i = 0; i < result.length; i++) {
    if (rng.next() < rate) {
      const available: RegularUnitId[] = [];
      for (const id of pool) {
        if (!used.has(id)) available.push(id);
      }
      if (available.length > 0) {
        const old = result[i]!;
        const picked = available[Math.floor(rng.next() * available.length)]!;
        result[i] = picked;
        used.delete(old);
        used.add(picked);
      }
    }
  }
  return result;
}

// ── Diversity ──

function teamKey(ids: readonly RegularUnitId[]): string {
  return [...ids].sort().join(",");
}

function computeDiversity(pop: readonly GaIndividual[]): number {
  const unique = new Set(pop.map((ind) => teamKey(ind.teamIds)));
  return unique.size / pop.length;
}

// ── Generation Evolution ──

async function evolveGeneration(
  pop: GaIndividual[],
  config: GaConfig,
  pool: readonly RegularUnitId[],
  genSeed: number,
  workers: Worker[],
): Promise<{ nextPop: GaIndividual[]; battles: number }> {
  const sorted = [...pop].sort((a, b) => b.fitness - a.fitness);
  const elites = sorted.slice(0, config.eliteCount);
  const rng = createSeededRng(genSeed);
  const trialBaseSeed = deriveSeed(genSeed, 7_000_000);

  // offspring生成（逐次・RNG依存）
  const childTeams: RegularUnitId[][] = [];
  while (childTeams.length < config.populationSize - config.eliteCount) {
    const parentA = tournamentSelect(pop, config.tournamentSize, rng);
    const parentB = tournamentSelect(pop, config.tournamentSize, rng);
    let childIds = crossover(parentA.teamIds, parentB.teamIds, pool, rng);
    childIds = mutate(childIds, pool, config.mutationRate, rng);
    childTeams.push(childIds);
  }

  const { winRates, battles } = await evaluateBatch(
    childTeams,
    config.night,
    config.trialsPerEval,
    trialBaseSeed,
    workers,
  );
  const offspring = childTeams.map((ids, i) => ({ teamIds: ids, fitness: winRates[i]! }));

  return { nextPop: [...elites, ...offspring], battles };
}

// ── Refinement ──

async function refineTopTeams(
  pop: readonly GaIndividual[],
  config: GaConfig,
  workers: Worker[],
): Promise<{ teams: GaRankedTeam[]; battles: number }> {
  const sorted = [...pop].sort((a, b) => b.fitness - a.fitness);
  const seen = new Set<string>();
  const unique: GaIndividual[] = [];
  for (const ind of sorted) {
    const key = teamKey(ind.teamIds);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(ind);
      if (unique.length >= config.refinementTopK) break;
    }
  }

  const trialBaseSeed = deriveSeed(config.baseSeed, 9_000_000);
  const { winRates, battles } = await evaluateBatch(
    unique.map((ind) => ind.teamIds),
    config.night,
    config.refinementTrials,
    trialBaseSeed,
    workers,
  );

  const teams: GaRankedTeam[] = unique.map((ind, i) => {
    const wins = Math.round(winRates[i]! * config.refinementTrials);
    const ci = wilsonCI(wins, config.refinementTrials);
    const viability = estimateTeamViability(
      ind.teamIds,
      config.night,
      deriveSeed(trialBaseSeed, i + 1),
      { samples: 10 },
    );
    return {
      teamIds: [...ind.teamIds],
      fitness: winRates[i]!,
      adjustedFitness: adjustFitnessForViability(winRates[i]!, viability),
      fitnessCI95: ci,
      viability,
      novelty: false,
    };
  });

  teams.sort((a, b) => b.adjustedFitness - a.adjustedFitness || b.fitness - a.fitness);
  return { teams, battles };
}

// ── Main Entry Point ──

const EARLY_STOP_DIVERSITY = 0.1;
const EARLY_STOP_WINDOW = 3;

export async function runGeneticAlgorithm(config: GaConfig, workers: Worker[]): Promise<GaResult> {
  const pool = getUniquePool(config.night);
  let pop = initPopulation(config.populationSize, config.night, config.baseSeed);
  let totalBattles = 0;

  const { winRates: initRates, battles: initBattles } = await evaluateBatch(
    pop.map((ind) => ind.teamIds),
    config.night,
    config.trialsPerEval,
    deriveSeed(config.baseSeed, 8_000_000),
    workers,
  );
  for (let i = 0; i < pop.length; i++) {
    pop[i]!.fitness = initRates[i]!;
  }
  totalBattles += initBattles;

  const generationStats: GaGenerationStats[] = [];
  let lowDiversityStreak = 0;

  for (let gen = 0; gen < config.generations; gen++) {
    const genSeed = deriveSeed(config.baseSeed, (gen + 1) * 100_000);
    const { nextPop, battles } = await evolveGeneration(pop, config, pool, genSeed, workers);
    pop = nextPop;
    totalBattles += battles;

    const sorted = [...pop].sort((a, b) => b.fitness - a.fitness);
    const diversity = computeDiversity(pop);
    const avgFitness = pop.reduce((s, ind) => s + ind.fitness, 0) / pop.length;
    generationStats.push({
      generation: gen,
      bestFitness: sorted[0]!.fitness,
      avgFitness,
      diversity,
    });

    if (diversity < EARLY_STOP_DIVERSITY) {
      lowDiversityStreak++;
      if (lowDiversityStreak >= EARLY_STOP_WINDOW) break;
    } else {
      lowDiversityStreak = 0;
    }
  }

  const { teams: topTeams, battles: refineBattles } = await refineTopTeams(pop, config, workers);
  totalBattles += refineBattles;

  return { topTeams, generationStats, totalBattles, config };
}
