import type { MatchupResult, UnitPerformance } from "./sim-types";

/** UnitPerformance の JSON-safe 版（winRateCI95 を mutable tuple に） */
export type UnitPerfRecord = Omit<UnitPerformance, "winRateCI95"> & {
  readonly winRateCI95: [number, number];
};

/** MatchupResult の JSON 版（Map→Record + warnings 追加） */
export type MatchupEntry = Omit<MatchupResult, "unitPerformance"> & {
  readonly unitPerformance: Record<string, UnitPerfRecord>;
  readonly warnings: readonly string[];
};

export interface RandomBalanceEntry {
  readonly night: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly trials: number;
  readonly winRate: number;
  readonly avgFrameCount: number;
  readonly unitPerformance: Record<string, UnitPerfRecord>;
  readonly uniqueUnitCount: number;
}

export interface PositionOptResult {
  readonly optimizedWinRate: number;
  readonly shuffledWinRate: number;
  readonly deltaPp: number;
  readonly trials: number;
}

export interface CrossNightOutlier {
  readonly unitId: string;
  readonly tier: number;
  readonly night: number;
  readonly winRate: number;
  readonly appearances: number;
}

export interface CrossNightEntry {
  readonly night: number;
  readonly winRate: number;
  readonly avgFrameCount: number;
  readonly uniqueUnitCount: number;
  readonly outliers: readonly CrossNightOutlier[];
}

export interface RankedUnit {
  readonly unitId: string;
  readonly perf: UnitPerfRecord;
}

export interface ScalingAnalysis {
  readonly topBuffReceivers: readonly RankedUnit[];
  readonly earliestDeaths: readonly RankedUnit[];
  readonly topDamageSponges: readonly RankedUnit[];
  readonly topKillers: readonly RankedUnit[];
  readonly topSpawners: readonly RankedUnit[];
}

export interface SimReportData {
  readonly generatedAt: string;
  readonly positionOptimization: PositionOptResult | null;
  readonly archetypeMatchups: readonly MatchupEntry[];
  readonly randomBalance: readonly RandomBalanceEntry[];
  readonly crossNight: readonly CrossNightEntry[];
  readonly scalingAnalysis: ScalingAnalysis | null;
}
