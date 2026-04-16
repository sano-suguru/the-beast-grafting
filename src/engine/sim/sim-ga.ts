import type { RegularUnitId, BattleResult, EnemyTeam } from "../../shared/types";
import type { Rng } from "../rng";
import type {
  GaConfig,
  GaGenerationStats,
  GaIndividual,
  GaRankedTeam,
  GaResult,
} from "./sim-ga-types";
import { createSeededRng } from "../rng";
import { getShopPool } from "../helpers";
import { generateSimTeam } from "./sim-team-gen";
import { buildProgressedUnit } from "./sim-progression";
import { applySimShopEffects } from "./sim-shop-effects";
import { simulateBattleResult } from "./sim-battle";
import { deriveSeed, makeSimEnemy } from "./sim-utils";
import { wilsonCI } from "./sim-perf";
import { TEAM_SIZE } from "./sim-types";

function getUniquePool(night: number): RegularUnitId[] {
  return [...new Set(getShopPool(night))];
}

function randomLastBattleResult(seed: number): BattleResult {
  return createSeededRng(seed).next() < 0.5 ? "LOSE" : null;
}

// ── Pre-built enemy scenarios ──

interface PreparedTrial {
  enemy: EnemyTeam;
  playerBuildSeed: number;
  playerShopSeed: number;
  battleSeed: number;
  lastResult: BattleResult;
}

function prepareTrials(night: number, trials: number, baseSeed: number): PreparedTrial[] {
  const prepared: PreparedTrial[] = [];
  for (let i = 0; i < trials; i++) {
    const enemyRng = createSeededRng(deriveSeed(baseSeed, i));
    const enemyIds = generateSimTeam(night, enemyRng);

    const eRng = createSeededRng(deriveSeed(baseSeed, trials * 2 + i));
    const eTeam = enemyIds.map((id) => buildProgressedUnit(id, night, eRng));
    applySimShopEffects(eTeam, night, createSeededRng(deriveSeed(baseSeed, trials * 4 + i)));

    prepared.push({
      enemy: makeSimEnemy(eTeam),
      playerBuildSeed: deriveSeed(baseSeed, trials + i),
      playerShopSeed: deriveSeed(baseSeed, trials * 3 + i),
      battleSeed: deriveSeed(baseSeed, trials * 5 + i),
      lastResult: randomLastBattleResult(deriveSeed(baseSeed, trials * 6 + i)),
    });
  }
  return prepared;
}

// ── Fitness Evaluation ──

function evaluateFitness(
  teamIds: readonly RegularUnitId[],
  night: number,
  prepared: readonly PreparedTrial[],
): { winRate: number; battles: number } {
  let wins = 0;
  for (const t of prepared) {
    const pRng = createSeededRng(t.playerBuildSeed);
    const pTeam = teamIds.map((id) => buildProgressedUnit(id, night, pRng));
    applySimShopEffects(pTeam, night, createSeededRng(t.playerShopSeed));

    const result = simulateBattleResult(pTeam, t.enemy, night, t.battleSeed, t.lastResult);
    if (result === "WIN") wins++;
  }
  return { winRate: wins / prepared.length, battles: prepared.length };
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

function evolveGeneration(
  pop: GaIndividual[],
  config: GaConfig,
  pool: readonly RegularUnitId[],
  genSeed: number,
): { nextPop: GaIndividual[]; battles: number } {
  const sorted = [...pop].sort((a, b) => b.fitness - a.fitness);
  const elites = sorted.slice(0, config.eliteCount);
  const offspring: GaIndividual[] = [];
  const rng = createSeededRng(genSeed);
  let battles = 0;

  const prepared = prepareTrials(
    config.night,
    config.trialsPerEval,
    deriveSeed(genSeed, 7_000_000),
  );

  while (offspring.length < config.populationSize - config.eliteCount) {
    const parentA = tournamentSelect(pop, config.tournamentSize, rng);
    const parentB = tournamentSelect(pop, config.tournamentSize, rng);
    let childIds = crossover(parentA.teamIds, parentB.teamIds, pool, rng);
    childIds = mutate(childIds, pool, config.mutationRate, rng);

    const { winRate, battles: b } = evaluateFitness(childIds, config.night, prepared);
    offspring.push({ teamIds: childIds, fitness: winRate });
    battles += b;
  }

  return { nextPop: [...elites, ...offspring], battles };
}

// ── Refinement ──

function refineTopTeams(
  pop: readonly GaIndividual[],
  config: GaConfig,
): { teams: GaRankedTeam[]; battles: number } {
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

  const prepared = prepareTrials(
    config.night,
    config.refinementTrials,
    deriveSeed(config.baseSeed, 9_000_000),
  );

  const teams: GaRankedTeam[] = [];
  let battles = 0;
  for (const ind of unique) {
    const { winRate, battles: b } = evaluateFitness(ind.teamIds, config.night, prepared);
    const wins = Math.round(winRate * config.refinementTrials);
    const ci = wilsonCI(wins, config.refinementTrials);
    teams.push({ teamIds: [...ind.teamIds], fitness: winRate, fitnessCI95: ci, novelty: false });
    battles += b;
  }
  return { teams, battles };
}

// ── Main Entry Point ──

const EARLY_STOP_DIVERSITY = 0.1;
const EARLY_STOP_WINDOW = 3;

export function runGeneticAlgorithm(config: GaConfig): GaResult {
  const pool = getUniquePool(config.night);
  let pop = initPopulation(config.populationSize, config.night, config.baseSeed);
  let totalBattles = 0;

  // Evaluate initial population with shared enemy set
  const initPrepared = prepareTrials(
    config.night,
    config.trialsPerEval,
    deriveSeed(config.baseSeed, 8_000_000),
  );
  for (let i = 0; i < pop.length; i++) {
    const { winRate, battles } = evaluateFitness(pop[i]!.teamIds, config.night, initPrepared);
    pop[i]!.fitness = winRate;
    totalBattles += battles;
  }

  const generationStats: GaGenerationStats[] = [];
  let lowDiversityStreak = 0;

  for (let gen = 0; gen < config.generations; gen++) {
    const genSeed = deriveSeed(config.baseSeed, (gen + 1) * 100_000);
    const { nextPop, battles } = evolveGeneration(pop, config, pool, genSeed);
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

  const { teams: topTeams, battles: refineBattles } = refineTopTeams(pop, config);
  totalBattles += refineBattles;

  return { topTeams, generationStats, totalBattles, config };
}
