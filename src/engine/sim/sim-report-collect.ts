import type { DataUnitId } from "../../shared/types";
import type { UnitPerformance } from "./sim-types";
import type {
  CrossNightEntry,
  CrossNightOutlier,
  CompositionEntry,
  InsufficientSampleEntry,
  MatchupEntry,
  PairSynergyEntry,
  PositionOptResult,
  RandomBalanceEntry,
  ScalingAnalysis,
  SimReportData,
  UnitPerfRecord,
} from "./sim-report-types";

export function perfToRecord(perf: UnitPerformance): UnitPerfRecord {
  return { ...perf, winRateCI95: [perf.winRateCI95[0], perf.winRateCI95[1]] };
}

export function perfMapToRecord(
  map: ReadonlyMap<DataUnitId, UnitPerformance>,
): Record<string, UnitPerfRecord> {
  const out: Record<string, UnitPerfRecord> = {};
  for (const [id, perf] of map) out[id] = perfToRecord(perf);
  return out;
}

interface MutableCrossNight {
  night: number;
  winRate: number;
  avgFrameCount: number;
  uniqueUnitCount: number;
  outliers: CrossNightOutlier[];
}

export class SimReportCollector {
  private _positionOpt: PositionOptResult | null = null;
  private readonly _matchups: MatchupEntry[] = [];
  private readonly _randomBalance: RandomBalanceEntry[] = [];
  private readonly _crossNight = new Map<number, MutableCrossNight>();
  private _scaling: ScalingAnalysis | null = null;
  private _pairSynergies: readonly PairSynergyEntry[] = [];
  private _discoveredCompositions: readonly CompositionEntry[] = [];
  private readonly _insufficientSamples: InsufficientSampleEntry[] = [];

  setPositionOpt(result: PositionOptResult): void {
    this._positionOpt = result;
  }

  addMatchup(entry: MatchupEntry): void {
    this._matchups.push(entry);
  }

  addRandomBalance(entry: RandomBalanceEntry): void {
    this._randomBalance.push(entry);
  }

  addCrossNight(
    night: number,
    winRate: number,
    avgFrameCount: number,
    uniqueUnitCount: number,
  ): void {
    const existing = this._crossNight.get(night);
    if (existing) {
      existing.winRate = winRate;
      existing.avgFrameCount = avgFrameCount;
      existing.uniqueUnitCount = uniqueUnitCount;
    } else {
      this._crossNight.set(night, { night, winRate, avgFrameCount, uniqueUnitCount, outliers: [] });
    }
  }

  addCrossNightOutlier(night: number, outlier: CrossNightOutlier): void {
    let entry = this._crossNight.get(night);
    if (!entry) {
      entry = { night, winRate: 0, avgFrameCount: 0, uniqueUnitCount: 0, outliers: [] };
      this._crossNight.set(night, entry);
    }
    entry.outliers.push(outlier);
  }

  setScalingAnalysis(analysis: ScalingAnalysis): void {
    this._scaling = analysis;
  }

  setPairSynergies(synergies: readonly PairSynergyEntry[]): void {
    this._pairSynergies = synergies;
  }

  setDiscoveredCompositions(compositions: readonly CompositionEntry[]): void {
    this._discoveredCompositions = compositions;
  }

  addInsufficientSample(entry: InsufficientSampleEntry): void {
    this._insufficientSamples.push(entry);
  }

  build(): SimReportData {
    const crossNight: CrossNightEntry[] = [...this._crossNight.values()]
      .sort((a, b) => a.night - b.night)
      .map((e) => ({
        night: e.night,
        winRate: e.winRate,
        avgFrameCount: e.avgFrameCount,
        uniqueUnitCount: e.uniqueUnitCount,
        outliers: e.outliers,
      }));

    return {
      generatedAt: new Date().toISOString(),
      positionOptimization: this._positionOpt,
      archetypeMatchups: this._matchups,
      randomBalance: this._randomBalance,
      crossNight,
      scalingAnalysis: this._scaling,
      pairSynergies: this._pairSynergies,
      discoveredCompositions: this._discoveredCompositions,
      insufficientSamples: this._insufficientSamples,
    };
  }
}
