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

export interface PairSynergyEntry {
  readonly unitA: string;
  readonly unitB: string;
  readonly coWinRate: number;
  readonly expectedWinRate: number;
  readonly synergyDelta: number;
  readonly sampleCount: number;
  readonly ciLower: number;
  readonly ciUpper: number;
}

export interface CompositionEntry {
  readonly name: string;
  readonly unitIds: readonly string[];
  readonly totalSynergyDelta: number;
}

export interface InsufficientSampleEntry {
  readonly unitId: string;
  readonly appearances: number;
  readonly ciWidth: number;
}

// ── GA Discovery ──

export interface GaRankedTeamEntry {
  readonly teamIds: readonly string[];
  readonly fitness: number;
  readonly fitnessCI95: [number, number];
  readonly novelty: boolean;
}

export interface GaGenerationStatsEntry {
  readonly generation: number;
  readonly bestFitness: number;
  readonly avgFitness: number;
  readonly diversity: number;
}

export interface GaReportData {
  readonly topTeams: readonly GaRankedTeamEntry[];
  readonly generationStats: readonly GaGenerationStatsEntry[];
  readonly totalBattles: number;
  readonly convergenceGeneration: number | null;
  readonly breakageAlerts: readonly string[];
}

export interface NightGaEntry {
  readonly night: number;
  readonly poolSize: number;
  readonly topTeams: readonly GaRankedTeamEntry[];
  readonly breakageAlerts: readonly string[];
}

/**
 * テスト各ブロックが独立にcollectorへデータを供給するため、
 * 単一セッターで設定するセクション（positionOptimization, scalingAnalysis, gaDiscovery）は
 * テスト未実行時に null となる。配列系セクションは空配列で表現。
 */
export interface SimReportData {
  readonly generatedAt: string;
  readonly positionOptimization: PositionOptResult | null;
  readonly archetypeMatchups: readonly MatchupEntry[];
  readonly randomBalance: readonly RandomBalanceEntry[];
  readonly crossNight: readonly CrossNightEntry[];
  readonly scalingAnalysis: ScalingAnalysis | null;
  readonly pairSynergies: readonly PairSynergyEntry[];
  readonly discoveredCompositions: readonly CompositionEntry[];
  readonly insufficientSamples: readonly InsufficientSampleEntry[];
  readonly gaDiscovery: GaReportData | null;
  readonly nightGaResults: readonly NightGaEntry[];
}
