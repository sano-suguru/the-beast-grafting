import type { BattleResult, RegularUnitId, UnitInstance, DataUnitId } from "../../shared/types";
import type {
  BattleMetrics,
  MatchupResult,
  RandomTrialResult,
  TeamTrial,
  UnitPerformance,
} from "./sim-types";
import { createSeededRng } from "../rng";
import { createUnit } from "../helpers";
import { simulateBattleSim } from "./sim-battle";
import { generateSimTeam } from "./sim-team-gen";
import { buildProgressedUnit } from "./sim-progression";
import { extractBattleMetricsSim } from "./sim-metrics";
import { type PerfMap, accumulatePerformance, finalizePerformance, percentile } from "./sim-perf";
import { deriveSeed, makeSimEnemy } from "./sim-utils";
import { applySimShopEffects } from "./sim-shop-effects";

function buildTeam(ids: readonly DataUnitId[]): UnitInstance[] {
  return ids.map((id) => createUnit(id));
}

function buildRealisticTeam(
  ids: readonly DataUnitId[],
  night: number,
  rng: { next(): number },
): UnitInstance[] {
  return ids.map((id) => buildProgressedUnit(id, night, rng));
}

function accumulateTrialPerformance(
  perfMap: PerfMap,
  metrics: BattleMetrics,
  result: BattleResult,
): void {
  for (const tally of metrics.unitActions.values()) {
    const won =
      (tally.side === "player" && result === "WIN") ||
      (tally.side === "enemy" && result === "LOSE");
    accumulatePerformance(perfMap, tally, won);
  }
}

function buildMatchupTeams(
  teamAIds: readonly DataUnitId[],
  teamBIds: readonly DataUnitId[],
  baseSeed: number,
  trials: number,
  i: number,
  night: number,
  realistic: boolean,
): [UnitInstance[], UnitInstance[]] {
  if (!realistic) return [buildTeam(teamAIds), buildTeam(teamBIds)];
  const pProgRng = createSeededRng(deriveSeed(baseSeed, trials * 2 + i));
  const eProgRng = createSeededRng(deriveSeed(baseSeed, trials * 3 + i));
  const teamA = buildRealisticTeam(teamAIds, night, pProgRng);
  const teamB = buildRealisticTeam(teamBIds, night, eProgRng);
  applySimShopEffects(teamA, night, createSeededRng(deriveSeed(baseSeed, trials * 4 + i)));
  applySimShopEffects(teamB, night, createSeededRng(deriveSeed(baseSeed, trials * 5 + i)));
  return [teamA, teamB];
}

/** 固定チーム同士の N 試行マッチアップ */
export function runMatchup(
  teamAIds: readonly DataUnitId[],
  teamBIds: readonly DataUnitId[],
  trials: number,
  baseSeed: number,
  night = 12,
  realistic = false,
): MatchupResult {
  let aWins = 0;
  let bWins = 0;
  let draws = 0;
  const winnerHps: number[] = [];
  const frameCounts: number[] = [];
  const perfMap: PerfMap = new Map();

  for (let i = 0; i < trials; i++) {
    const seed = deriveSeed(baseSeed, i);
    const [teamA, teamB] = buildMatchupTeams(
      teamAIds,
      teamBIds,
      baseSeed,
      trials,
      i,
      night,
      realistic,
    );
    const sim = simulateBattleSim(teamA, makeSimEnemy(teamB), night, seed);

    const m = extractBattleMetricsSim(sim);
    frameCounts.push(m.frameCount);
    winnerHps.push(m.winnerRemainingHp);
    accumulateTrialPerformance(perfMap, m, sim.result);

    if (sim.result === "WIN") aWins++;
    else if (sim.result === "LOSE") bWins++;
    else draws++;
  }

  frameCounts.sort((a, b) => a - b);
  winnerHps.sort((a, b) => a - b);

  const totalFrames = frameCounts.reduce((s, v) => s + v, 0);
  const totalWinnerHp = winnerHps.reduce((s, v) => s + v, 0);

  return {
    teamA: teamAIds.join(","),
    teamB: teamBIds.join(","),
    aWins,
    bWins,
    draws,
    trials,
    avgFrameCount: totalFrames / trials,
    avgWinnerRemainingHp: totalWinnerHp / trials,
    winMarginMedian: percentile(winnerHps, 0.5),
    frameCountP25: percentile(frameCounts, 0.25),
    frameCountP75: percentile(frameCounts, 0.75),
    unitPerformance: finalizePerformance(perfMap) as ReadonlyMap<DataUnitId, UnitPerformance>,
  };
}

/** 一様ランダムチーム同士の N 試行 */
export function runRandomTrials(
  trials: number,
  night: number,
  baseSeed: number,
): RandomTrialResult {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let totalFrames = 0;
  const perfMap: PerfMap = new Map();
  const teamTrials: TeamTrial[] = [];

  for (let i = 0; i < trials; i++) {
    const pRng = createSeededRng(deriveSeed(baseSeed, i * 2));
    const eRng = createSeededRng(deriveSeed(baseSeed, i * 2 + 1));
    const battleSeed = deriveSeed(baseSeed, trials + i);

    const pIds = generateSimTeam(night, pRng);
    const eIds = generateSimTeam(night, eRng);
    const pProgRng = createSeededRng(deriveSeed(baseSeed, trials * 3 + i));
    const eProgRng = createSeededRng(deriveSeed(baseSeed, trials * 4 + i));
    const pTeam = buildRealisticTeam(pIds, night, pProgRng);
    const eTeam = buildRealisticTeam(eIds, night, eProgRng);
    const pShopRng = createSeededRng(deriveSeed(baseSeed, trials * 5 + i));
    const eShopRng = createSeededRng(deriveSeed(baseSeed, trials * 6 + i));
    applySimShopEffects(pTeam, night, pShopRng);
    applySimShopEffects(eTeam, night, eShopRng);
    const sim = simulateBattleSim(pTeam, makeSimEnemy(eTeam), night, battleSeed);

    const m = extractBattleMetricsSim(sim);
    totalFrames += m.frameCount;
    accumulateTrialPerformance(perfMap, m, sim.result);

    teamTrials.push({ teamIds: pIds, won: sim.result === "WIN" });
    teamTrials.push({ teamIds: eIds, won: sim.result === "LOSE" });

    if (sim.result === "WIN") wins++;
    else if (sim.result === "LOSE") losses++;
    else draws++;
  }

  return {
    wins,
    losses,
    draws,
    trials,
    winRate: wins / trials,
    avgFrameCount: totalFrames / trials,
    unitPerformance: finalizePerformance(perfMap) as ReadonlyMap<RegularUnitId, UnitPerformance>,
    teamTrials,
  };
}
