import { UNITS } from "../../shared/data/units";
import type { RegularUnitId } from "../../shared/types";
import type { RandomTrialResult, UnitPerformance } from "./sim-types";
import { createSeededRng } from "../rng";
import { generateSimTeam } from "./sim-team-gen";
import { findOptimalPositioning, positionArchetypes } from "./sim-position";
import { runMatchup, runRandomTrials } from "./sim-runner";
import { analyzePairSynergies, discoverArchetypes } from "./sim-archetype-discovery";
import type { DiscoveredArchetype, PairSynergy } from "./sim-archetype-discovery";
import { createUnit } from "../helpers";
import { simulateBattleResult } from "./sim-battle";
import { buildProgressedUnit } from "./sim-progression";
import { SimReportCollector, perfMapToRecord, perfToRecord } from "./sim-report-collect";
import { writeSimReport } from "./sim-report-write";
import { makeSimEnemy } from "./sim-utils";

const collector = new SimReportCollector();

afterAll(() => {
  writeSimReport(collector.build());
});

// ── チーム生成 ──

describe("generateSimTeam", () => {
  it("produces exactly 5 unique units", () => {
    const team = generateSimTeam(12, createSeededRng(42));
    expect(team).toHaveLength(5);
    expect(new Set(team).size).toBe(5);
  });

  it("is deterministic with same seed", () => {
    const a = generateSimTeam(12, createSeededRng(42));
    const b = generateSimTeam(12, createSeededRng(42));
    expect(a).toEqual(b);
  });

  it("produces varied teams across seeds", () => {
    const teams = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) {
      const team = generateSimTeam(12, createSeededRng(seed));
      teams.add([...team].sort().join(","));
    }
    expect(teams.size).toBeGreaterThan(10);
  });

  it("respects tier restrictions for early nights", () => {
    const team = generateSimTeam(1, createSeededRng(42));
    for (const id of team) {
      expect(UNITS[id]!.tier, `${id} tier`).toBe(1);
    }
  });
});

// ── ブルートフォースポジション最適化 ──

describe("findOptimalPositioning", () => {
  it("returns a permutation of the input", () => {
    const ids: RegularUnitId[] = ["rat", "parasite", "bat", "martyr", "crow"];
    const result = findOptimalPositioning(ids, 12, 42, 20);
    expect([...result].sort()).toEqual([...ids].sort());
  });

  it("is deterministic with same seed", () => {
    const ids: RegularUnitId[] = ["brains", "eye", "rat", "bat", "crow"];
    const a = findOptimalPositioning(ids, 12, 99, 20);
    const b = findOptimalPositioning(ids, 12, 99, 20);
    expect(a).toEqual(b);
  });
});

// ── 現実的チーム生成 ──

describe("buildProgressedUnit", () => {
  it("Night 1 produces level 1 base-stat units", () => {
    const rng = createSeededRng(42);
    const u = buildProgressedUnit("rat", 1, rng);
    expect(u.level).toBe(1);
    expect(u.exp).toBe(0);
    expect(u.equip).toBeNull();
    expect(u.buffAtk).toBe(0);
    expect(u.buffHp).toBe(0);
    const base = createUnit("rat");
    expect(u.baseAtk).toBe(base.baseAtk);
    expect(u.baseHp).toBe(base.baseHp);
  });

  it("Night 12 produces stronger units with possible level-ups and equips", () => {
    let hasEquip = false;
    let hasLevelUp = false;
    let hasStatGain = false;
    for (let seed = 1; seed <= 100; seed++) {
      const rng = createSeededRng(seed);
      const u = buildProgressedUnit("rat", 12, rng);
      const base = createUnit("rat");
      if (u.equip !== null) hasEquip = true;
      if (u.level > 1) hasLevelUp = true;
      if (u.baseAtk > base.baseAtk || u.baseHp > base.baseHp) hasStatGain = true;
    }
    expect(hasEquip).toBe(true);
    expect(hasLevelUp).toBe(true);
    expect(hasStatGain).toBe(true);
  });

  it("is deterministic with same seed", () => {
    const a = buildProgressedUnit("insatiable_maw", 10, createSeededRng(99));
    const b = buildProgressedUnit("insatiable_maw", 10, createSeededRng(99));
    expect(a.baseAtk).toBe(b.baseAtk);
    expect(a.baseHp).toBe(b.baseHp);
    expect(a.level).toBe(b.level);
    expect(a.equip).toBe(b.equip);
  });
});

// ── ポジション最適化の効果検証 ──

describe("position optimization effectiveness", () => {
  it("brute-force optimized positions win more than random", () => {
    const TEAMS = 5;
    const TRIALS_PER_TEAM = 100;
    let optimizedWins = 0;
    let randomWins = 0;
    let totalBattles = 0;

    for (let i = 0; i < TEAMS; i++) {
      const rng = createSeededRng(i + 1);
      const team = generateSimTeam(12, rng);

      const optimized = findOptimalPositioning(team, 12, i * 1000 + 1, 30);

      for (let t = 0; t < TRIALS_PER_TEAM; t++) {
        const enemyRng = createSeededRng(i * 1000 + t + 500);
        const enemy = generateSimTeam(12, enemyRng);
        const battleSeed = (i + 1) * 10000 + t + 1;

        const r1 = simulateBattleResult(
          optimized.map((id) => createUnit(id)),
          makeSimEnemy(enemy.map((id) => createUnit(id))),
          12,
          battleSeed,
        );
        const r2 = simulateBattleResult(
          team.map((id) => createUnit(id)),
          makeSimEnemy(enemy.map((id) => createUnit(id))),
          12,
          battleSeed,
        );

        if (r1 === "WIN") optimizedWins++;
        if (r2 === "WIN") randomWins++;
        totalBattles++;
      }
    }

    const optRate = optimizedWins / totalBattles;
    const rndRate = randomWins / totalBattles;
    collector.setPositionOpt({
      optimizedWinRate: optRate,
      shuffledWinRate: rndRate,
      deltaPp: (optRate - rndRate) * 100,
      trials: totalBattles,
    });
    expect(optRate).toBeGreaterThanOrEqual(rndRate);
  });
});

// ── ランダムバランス（独立テスト） ──

describe("random balance", () => {
  it("mirror win rate is roughly even", () => {
    const r = runRandomTrials(1000, 12, 42);
    expect(r.winRate).toBeGreaterThan(0.35);
    expect(r.winRate).toBeLessThan(0.65);
  });

  it("unit diversity: most units appear at least once", () => {
    const r = runRandomTrials(500, 12, 200);
    const poolSize = Object.keys(UNITS).length;
    expect(r.unitPerformance.size).toBeGreaterThan(poolSize * 0.7);
  });
});

// ── パイプライン: ランダム試行 → ペアシナジー → アーキタイプ発見 → 対戦 ──

describe("archetype discovery pipeline", () => {
  let trialResult: RandomTrialResult;
  let pairSynergies: readonly PairSynergy[];
  let archetypes: readonly DiscoveredArchetype[];
  let positioned: ReadonlyMap<string, readonly RegularUnitId[]>;

  beforeAll(() => {
    trialResult = runRandomTrials(30_000, 12, 100);
    pairSynergies = analyzePairSynergies(
      trialResult.teamTrials,
      trialResult.unitPerformance,
      trialResult.winRate,
    );
    archetypes = discoverArchetypes(pairSynergies, trialResult.unitPerformance);
    positioned = positionArchetypes(archetypes, 12, 200, 30);
  }, 120_000);

  it("no unit dominates: per-unit win rate within bounds", () => {
    const PRECISION_THRESHOLD = 0.1;
    const TIER_NORM_LIMIT = 0.2;

    for (const [id, perf] of trialResult.unitPerformance) {
      const [ciLo, ciHi] = perf.winRateCI95;
      const ciWidth = ciHi - ciLo;

      if (ciWidth > PRECISION_THRESHOLD) {
        collector.addInsufficientSample({ unitId: id, appearances: perf.appearances, ciWidth });
        continue;
      }

      const winRate = perf.wins / perf.appearances;
      // Layer 1: absolute limits
      expect(winRate, `${id} too strong (absolute)`).toBeLessThan(0.85);
      expect(winRate, `${id} too weak (absolute)`).toBeGreaterThan(0.15);
      // Layer 2: tier-relative limits
      const tierNorm = perf.tierNormalizedWinRate;
      expect(tierNorm, `${id} too strong for tier`).toBeLessThan(TIER_NORM_LIMIT);
      expect(tierNorm, `${id} too weak for tier`).toBeGreaterThan(-TIER_NORM_LIMIT);
    }

    collector.addRandomBalance({
      night: 12,
      wins: trialResult.wins,
      losses: trialResult.losses,
      draws: trialResult.draws,
      trials: trialResult.trials,
      winRate: trialResult.winRate,
      avgFrameCount: trialResult.avgFrameCount,
      unitPerformance: perfMapToRecord(trialResult.unitPerformance),
      uniqueUnitCount: trialResult.unitPerformance.size,
    });
  });

  it("discovers pair synergies with sufficient samples", () => {
    expect(pairSynergies.length).toBeGreaterThan(0);
    for (const s of pairSynergies) {
      expect(s.sampleCount).toBeGreaterThanOrEqual(30);
    }

    collector.setPairSynergies(
      pairSynergies.slice(0, 50).map((s) => ({
        unitA: s.unitA,
        unitB: s.unitB,
        coWinRate: s.coWinRate,
        expectedWinRate: s.expectedWinRate,
        synergyDelta: s.synergyDelta,
        sampleCount: s.sampleCount,
        ciLower: s.ciLower,
        ciUpper: s.ciUpper,
      })),
    );
  });

  it("CI width narrows with larger samples", () => {
    const sorted = [...pairSynergies].sort((a, b) => a.sampleCount - b.sampleCount);
    expect(sorted.length).toBeGreaterThanOrEqual(10);

    const lowN = sorted.slice(0, 5);
    const highN = sorted.slice(-5);
    const avgWidth = (ps: readonly PairSynergy[]) =>
      ps.reduce((s, p) => s + (p.ciUpper - p.ciLower), 0) / ps.length;

    expect(avgWidth(highN), "higher sample CIs should be narrower").toBeLessThan(avgWidth(lowN));
  });

  it("discovers at least 5 compositions", () => {
    expect(archetypes.length).toBeGreaterThanOrEqual(5);

    collector.setDiscoveredCompositions(
      archetypes.map((a) => ({
        name: a.name,
        unitIds: [...a.unitIds],
        totalSynergyDelta: a.totalSynergyDelta,
      })),
    );
  });

  it("discovered compositions have no duplicate members", () => {
    for (const arch of archetypes) {
      expect(new Set(arch.unitIds).size, `${arch.name} has duplicates`).toBe(arch.unitIds.length);
      expect(arch.unitIds.length, `${arch.name} size`).toBe(5);
    }
  });

  it("runs all-vs-all without crashing", () => {
    const names = [...positioned.keys()];
    const TRIALS = 1_000;

    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = names[i]!;
        const b = names[j]!;
        const r = runMatchup(
          positioned.get(a)!,
          positioned.get(b)!,
          TRIALS,
          (i + 1) * 1000 + j,
          12,
          true,
        );
        const aRate = r.aWins / r.trials;
        expect(r.trials).toBe(TRIALS);
        expect(r.aWins + r.bWins + r.draws).toBe(TRIALS);

        const warnings: string[] = [];
        if (aRate > 0.8 || aRate < 0.2)
          warnings.push(`IMBALANCE: ${aRate > 0.5 ? a : b} dominates`);
        if (r.avgFrameCount < 5) warnings.push("STOMP: battles too short");
        if (r.avgFrameCount > 80) warnings.push("STALL: battles too long");

        collector.addMatchup({
          teamA: a,
          teamB: b,
          aWins: r.aWins,
          bWins: r.bWins,
          draws: r.draws,
          trials: r.trials,
          avgFrameCount: r.avgFrameCount,
          avgWinnerRemainingHp: r.avgWinnerRemainingHp,
          winMarginMedian: r.winMarginMedian,
          frameCountP25: r.frameCountP25,
          frameCountP75: r.frameCountP75,
          unitPerformance: perfMapToRecord(r.unitPerformance),
          warnings,
        });
      }
    }
  });
});

// ── Night-varying バランス ──

describe("cross-night balance", () => {
  const NIGHT_CHECKPOINTS = [3, 5, 7, 9, 12] as const;
  const TRIALS_PER_NIGHT = 2_000;

  it("mirror win rate stays balanced across nights", () => {
    for (const night of NIGHT_CHECKPOINTS) {
      const r = runRandomTrials(TRIALS_PER_NIGHT, night, night * 100);
      collector.addCrossNight(night, r.winRate, r.avgFrameCount, r.unitPerformance.size);
      expect(r.winRate, `night ${night}`).toBeGreaterThan(0.3);
      expect(r.winRate, `night ${night}`).toBeLessThan(0.7);
    }
  });

  it("no unit dominates at any night checkpoint", () => {
    for (const night of NIGHT_CHECKPOINTS) {
      const r = runRandomTrials(TRIALS_PER_NIGHT, night, night * 200);
      for (const [id, perf] of r.unitPerformance) {
        const [ciLo, ciHi] = perf.winRateCI95;
        const ciWidth = ciHi - ciLo;
        if (ciWidth > 0.15) continue;

        const winRate = perf.wins / perf.appearances;
        if (winRate > 0.75 || winRate < 0.25) {
          collector.addCrossNightOutlier(night, {
            unitId: id,
            tier: UNITS[id]?.tier ?? 0,
            night,
            winRate,
            appearances: perf.appearances,
          });
        }
        expect(winRate, `${id} at night ${night}`).toBeLessThan(0.85);
        expect(winRate, `${id} at night ${night}`).toBeGreaterThan(0.15);
      }
    }
  });
});

// ── バフ・死亡タイミング・キル・スポーン分析 ──

function toRanked([id, perf]: [RegularUnitId, UnitPerformance]) {
  return { unitId: id, perf: perfToRecord(perf) };
}

describe("scaling & durability analysis", () => {
  it("identifies top buff receivers and earliest deaths", () => {
    const r = runRandomTrials(1000, 12, 300);
    const MIN = 80;

    const entries = [...r.unitPerformance.entries()].filter(([, p]) => p.appearances >= MIN);

    const byBuff = [...entries].sort(
      (a, b) => b[1].avgBuffAtk + b[1].avgBuffHp - (a[1].avgBuffAtk + a[1].avgBuffHp),
    );
    const withDeath = entries.filter(([, p]) => p.avgDeathFrame !== null);
    const byEarlyDeath = [...withDeath].sort(
      (a, b) => (a[1].avgDeathFrame ?? 999) - (b[1].avgDeathFrame ?? 999),
    );
    const byDmgReceived = [...entries].sort(
      (a, b) => b[1].avgDamageReceived - a[1].avgDamageReceived,
    );
    const byKills = [...entries].sort((a, b) => b[1].avgKills - a[1].avgKills);
    const bySpawns = [...entries]
      .sort((a, b) => b[1].avgSpawnsProduced - a[1].avgSpawnsProduced)
      .filter(([, p]) => p.avgSpawnsProduced > 0);

    collector.setScalingAnalysis({
      topBuffReceivers: byBuff.slice(0, 10).map(toRanked),
      earliestDeaths: byEarlyDeath.slice(0, 10).map(toRanked),
      topDamageSponges: byDmgReceived.slice(0, 10).map(toRanked),
      topKillers: byKills.slice(0, 10).map(toRanked),
      topSpawners: bySpawns.slice(0, 10).map(toRanked),
    });

    expect(entries.length).toBeGreaterThan(0);
  });
});
