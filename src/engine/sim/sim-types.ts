import type {
  BattleAction,
  BattleResult,
  DataUnitId,
  RegularUnitId,
  UnitId,
} from "../../shared/types";
import type { Tier } from "../../shared/data/tiers";

/** Tier → 最速出現Night。sim-progression と sim-shop-effects で共用。 */
export const TIER_APPEAR_NIGHT: Record<Tier, number> = {
  1: 1,
  2: 3,
  3: 5,
  4: 7,
  5: 9,
  6: 11,
};

export interface SimUnitEntry {
  readonly id: UnitId;
  readonly side: "player" | "enemy";
}

export interface SimMetricsCollector {
  readonly frameActions: Record<string, BattleAction>[];
  readonly unitRegistry: Map<string, SimUnitEntry>;
}

export interface SimBattleResult {
  readonly result: BattleResult;
  readonly frameCount: number;
  readonly simFrameActions: readonly Record<string, BattleAction>[];
  readonly unitRegistry: ReadonlyMap<string, SimUnitEntry>;
  readonly pSurvivorUids: ReadonlySet<string>;
  readonly eSurvivorUids: ReadonlySet<string>;
  readonly winnerRemainingHp: number;
}

// ── 1戦闘のメトリクス ──

export interface UnitActionTally {
  readonly unitId: UnitId;
  readonly side: "player" | "enemy";
  readonly damageDealt: number;
  readonly damageReceived: number;
  readonly buffAtk: number;
  readonly buffHp: number;
  readonly skillCount: number;
  readonly kills: number;
  readonly spawnsProduced: number;
  readonly buffAtkGiven: number;
  readonly buffHpGiven: number;
  readonly healingDone: number;
  readonly healingReceived: number;
  readonly survived: boolean;
  readonly deathFrame: number | null;
}

export interface BattleMetrics {
  readonly frameCount: number;
  readonly result: BattleResult;
  readonly pSurvivorCount: number;
  readonly eSurvivorCount: number;
  readonly winnerRemainingHp: number;
  readonly unitActions: ReadonlyMap<string, UnitActionTally>;
}

// ── 複数試行の集約 ──

export interface UnitPerformance {
  readonly appearances: number;
  readonly wins: number;
  readonly totalDamage: number;
  readonly avgDamage: number;
  readonly avgDamageReceived: number;
  readonly avgBuffAtk: number;
  readonly avgBuffHp: number;
  readonly avgKills: number;
  readonly avgSpawnsProduced: number;
  readonly avgBuffAtkGiven: number;
  readonly avgBuffHpGiven: number;
  readonly avgHealingDone: number;
  readonly avgHealingReceived: number;
  readonly survivalRate: number;
  readonly avgDeathFrame: number | null;
  readonly totalSkillActivations: number;
  readonly tier: number;
  readonly tierNormalizedWinRate: number;
  readonly impactScore: number;
  readonly winRateCI95: readonly [number, number];
}

// ── Runner の戻り値型 ──

export interface SimResult {
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly trials: number;
  readonly winRate: number;
}

export interface MatchupResult {
  readonly teamA: string;
  readonly teamB: string;
  readonly aWins: number;
  readonly bWins: number;
  readonly draws: number;
  readonly trials: number;
  readonly avgFrameCount: number;
  readonly avgWinnerRemainingHp: number;
  readonly winMarginMedian: number;
  readonly frameCountP25: number;
  readonly frameCountP75: number;
  readonly unitPerformance: ReadonlyMap<DataUnitId, UnitPerformance>;
}

export interface RandomTrialResult extends SimResult {
  readonly avgFrameCount: number;
  readonly unitPerformance: ReadonlyMap<RegularUnitId, UnitPerformance>;
  readonly teamTrials: readonly TeamTrial[];
}

export const TEAM_SIZE = 5;

export interface TeamTrial {
  readonly teamIds: readonly RegularUnitId[];
  readonly won: boolean;
}
