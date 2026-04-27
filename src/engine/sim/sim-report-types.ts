import type { MatchupResult, UnitPerformance } from "./sim-types";
import type { MetaCandidate } from "./sim-types";
import type { GaGenerationStats, GaRankedTeam } from "./sim-ga-types";

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

export interface MetaCandidateEntry extends MetaCandidate {
  readonly reachabilityScore: number;
}

export interface InsufficientSampleEntry {
  readonly unitId: string;
  readonly appearances: number;
  readonly ciWidth: number;
}

// ── Meta Analysis ──

export interface PayoffCell {
  readonly winRate: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
}

export interface DominantTeam {
  readonly team: string;
  readonly type: "weak" | "strong";
  readonly minWinRate: number;
}

export interface NashEntry {
  readonly team: string;
  readonly probability: number;
}

export type MetaHealthVerdict = "healthy" | "slightly_skewed" | "dominant_meta" | "degenerate";

export interface MetaAnalysis {
  readonly teamLabels: readonly string[];
  readonly payoffMatrix: readonly (readonly PayoffCell[])[];
  readonly dominantTeams: readonly DominantTeam[];
  readonly nashEquilibrium: readonly NashEntry[];
  readonly nashConverged: boolean;
  readonly equilibriumEntropy: number;
  readonly maxEntropy: number;
  readonly cyclicityScore: number;
  readonly healthVerdict: MetaHealthVerdict;
  readonly verdictReasons: readonly string[];
}

// ── GA Discovery ──

/** GaRankedTeam の JSON-safe 版（RegularUnitId → string, readonly tuple → mutable tuple） */
export type GaRankedTeamEntry = Omit<GaRankedTeam, "teamIds" | "fitnessCI95"> & {
  readonly teamIds: readonly string[];
  readonly fitnessCI95: [number, number];
};

export type GaGenerationStatsEntry = GaGenerationStats;

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
  readonly metaCandidates: readonly MetaCandidateEntry[];
  readonly insufficientSamples: readonly InsufficientSampleEntry[];
  readonly gaDiscovery: GaReportData | null;
  readonly nightGaResults: readonly NightGaEntry[];
  readonly metaAnalysis: MetaAnalysis | null;
}
