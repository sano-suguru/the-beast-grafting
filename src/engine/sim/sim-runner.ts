import type {
  BattleResult,
  RegularUnitId,
  UnitInstance,
  EnemyTeam,
  DataUnitId,
} from "../../shared/types";
import type { BattleMetrics, MatchupResult, RandomTrialResult, UnitPerformance } from "./sim-types";
import { createSeededRng } from "../rng";
import { createUnit } from "../helpers";
import { simulateBattle } from "../battle";
import { generateSimTeam } from "./sim-team-gen";
import { buildProgressedUnit } from "./sim-progression";
import { optimizePositions } from "./sim-position";
import { extractBattleMetrics } from "./sim-metrics";
import { type PerfMap, accumulatePerformance, finalizePerformance, percentile } from "./sim-perf";

function deriveSeed(baseSeed: number, index: number): number {
  const raw = Math.imul(baseSeed ^ index, 2654435761) >>> 0;
  return raw || 1;
}

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

function makeEnemy(units: UnitInstance[]): EnemyTeam {
  return { teamName: "[SIM]", teamType: "同業者", units, night: null, life: null, trophy: null };
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
    const pProgRng = realistic ? createSeededRng(deriveSeed(baseSeed, trials * 2 + i)) : null;
    const eProgRng = realistic ? createSeededRng(deriveSeed(baseSeed, trials * 3 + i)) : null;
    const teamA = pProgRng ? buildRealisticTeam(teamAIds, night, pProgRng) : buildTeam(teamAIds);
    const teamB = eProgRng ? buildRealisticTeam(teamBIds, night, eProgRng) : buildTeam(teamBIds);
    const enemy = makeEnemy(teamB);
    const { frames, result } = simulateBattle(teamA, enemy, night, seed);

    const m = extractBattleMetrics(frames, result);
    frameCounts.push(m.frameCount);
    winnerHps.push(m.winnerRemainingHp);
    accumulateTrialPerformance(perfMap, m, result);

    if (result === "WIN") aWins++;
    else if (result === "LOSE") bWins++;
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

/** シナジー重み付きランダムチーム同士の N 試行 */
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

  for (let i = 0; i < trials; i++) {
    const pRng = createSeededRng(deriveSeed(baseSeed, i * 2));
    const eRng = createSeededRng(deriveSeed(baseSeed, i * 2 + 1));
    const battleSeed = deriveSeed(baseSeed, trials + i);

    const pIds = optimizePositions(generateSimTeam(night, pRng));
    const eIds = optimizePositions(generateSimTeam(night, eRng));
    const pProgRng = createSeededRng(deriveSeed(baseSeed, trials * 3 + i));
    const eProgRng = createSeededRng(deriveSeed(baseSeed, trials * 4 + i));
    const { frames, result } = simulateBattle(
      buildRealisticTeam(pIds, night, pProgRng),
      makeEnemy(buildRealisticTeam(eIds, night, eProgRng)),
      night,
      battleSeed,
    );

    const m = extractBattleMetrics(frames, result);
    totalFrames += m.frameCount;
    accumulateTrialPerformance(perfMap, m, result);

    if (result === "WIN") wins++;
    else if (result === "LOSE") losses++;
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
  };
}
