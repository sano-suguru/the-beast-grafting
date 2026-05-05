import { UNITS } from "../../shared/data/units";
import type { RegularUnitId } from "../../shared/types";
import { effectiveAtk } from "../../shared/unit-stats";
import type { RandomTrialResult, UnitPerformance } from "./sim-types";
import { createSeededRng } from "../rng";
import { generateSimTeam } from "./sim-team-gen";
import { getShopPool } from "../helpers";
import { findOptimalPositioning, positionArchetypes } from "./sim-position";
import { runMatchup, runRandomTrials } from "./sim-runner";
import { analyzePairSynergies, jaccardSimilarity } from "./sim-pair-synergy";
import type { DiscoveredArchetype, PairSynergy } from "./sim-pair-synergy";
import { discoverArchetypes } from "./sim-archetype-greedy";
import { buildMetaCandidateFrontier } from "./sim-meta-frontier";
import type { MetaCandidate } from "./sim-types";
import { createUnit } from "../helpers";
import { simulateBattleResult } from "./sim-battle";
import { buildProgressedTeam } from "./sim-progression";
import { SimReportCollector, perfMapToRecord, perfToRecord } from "./sim-report-collect";
import type { MatchupEntry } from "./sim-report-types";
import { writeSimReport } from "./sim-report-write";
import { makeSimEnemy } from "./sim-utils";
import type { Worker } from "node:worker_threads";
import { createGaWorkerPool, runGeneticAlgorithm, terminateGaWorkerPool } from "./sim-ga";
import type { GaRankedTeam, GaResult } from "./sim-ga-types";
import { analyzeMetaHealth } from "./sim-meta-analysis";

const collector = new SimReportCollector();
const allMatchupEntries: MatchupEntry[] = [];
let latestGreedyArchetypes: readonly DiscoveredArchetype[] = [];
let latestGaTopTeams: readonly GaRankedTeam[] = [];
let latestNightGaTopTeams: readonly GaRankedTeam[] = [];

const workerCount = process.env["SIM_WORKERS"] ? Number(process.env["SIM_WORKERS"]) : undefined;
let gaWorkerPool: Worker[];
beforeAll(() => {
  gaWorkerPool = createGaWorkerPool(workerCount);
});
afterAll(() => {
  terminateGaWorkerPool(gaWorkerPool);
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
    const ids: RegularUnitId[] = ["rat", "parasite", "bat", "martyr", "gut_hand"];
    const result = findOptimalPositioning(ids, 12, 42, 20);
    expect([...result].sort()).toEqual([...ids].sort());
  });

  it("is deterministic with same seed", () => {
    const ids: RegularUnitId[] = ["brains", "eye", "rat", "bat", "gut_hand"];
    const a = findOptimalPositioning(ids, 12, 99, 20);
    const b = findOptimalPositioning(ids, 12, 99, 20);
    expect(a).toEqual(b);
  });
});

// ── 現実的チーム生成 ──

describe("buildProgressedTeam (unit progression)", () => {
  it("Night 1 produces level 1 base-stat units", () => {
    const rng = createSeededRng(42);
    const [u] = buildProgressedTeam(["rat"], 1, rng);
    expect(u!.level).toBe(1);
    expect(u!.exp).toBe(0);
    expect(u!.equip).toBeNull();
    expect(u!.buffAtk).toBe(0);
    expect(u!.buffHp).toBe(0);
    const base = createUnit("rat");
    expect(u!.baseAtk).toBe(base.baseAtk);
    expect(u!.baseHp).toBe(base.baseHp);
  });

  it("Night 12 produces stronger units with possible level-ups and equips", () => {
    let hasEquip = false;
    let hasLevelUp = false;
    let hasStatGain = false;
    for (let seed = 1; seed <= 100; seed++) {
      const rng = createSeededRng(seed);
      const [u] = buildProgressedTeam(["rat"], 12, rng);
      const base = createUnit("rat");
      if (u!.equip !== null) hasEquip = true;
      if (u!.level > 1) hasLevelUp = true;
      if (u!.baseAtk > base.baseAtk || u!.baseHp > base.baseHp) hasStatGain = true;
    }
    expect(hasEquip).toBe(true);
    expect(hasLevelUp).toBe(true);
    expect(hasStatGain).toBe(true);
  });

  it("is deterministic with same seed", () => {
    const [a] = buildProgressedTeam(["insatiable_maw"], 10, createSeededRng(99));
    const [b] = buildProgressedTeam(["insatiable_maw"], 10, createSeededRng(99));
    expect(a!.baseAtk).toBe(b!.baseAtk);
    expect(a!.baseHp).toBe(b!.baseHp);
    expect(a!.level).toBe(b!.level);
    expect(a!.equip).toBe(b!.equip);
  });

  it("Tier6 unit at Night 12 is weaker than Tier1 unit at Night 12 (tier-aware progression)", () => {
    let tier1TotalAtk = 0;
    let tier6TotalAtk = 0;
    const samples = 200;
    for (let seed = 1; seed <= samples; seed++) {
      const [t1] = buildProgressedTeam(["rat"], 12, createSeededRng(seed)); // Tier1
      const [t6] = buildProgressedTeam(["beelzebub"], 12, createSeededRng(seed)); // Tier6
      tier1TotalAtk += effectiveAtk(t1!);
      tier6TotalAtk += effectiveAtk(t6!);
    }
    expect(tier1TotalAtk).toBeGreaterThan(tier6TotalAtk);
  });

  it("Tier3 unit on its first available night (Night 5) returns exact base stats", () => {
    const base = createUnit("parasite"); // Tier3
    for (let seed = 1; seed <= 20; seed++) {
      const [u] = buildProgressedTeam(["parasite"], 5, createSeededRng(seed));
      expect(u!.level).toBe(1);
      expect(u!.exp).toBe(0);
      expect(u!.equip).toBeNull();
      expect(u!.buffAtk).toBe(0);
      expect(u!.buffHp).toBe(0);
      expect(u!.baseAtk).toBe(base.baseAtk);
      expect(u!.baseHp).toBe(base.baseHp);
    }
  });

  it("Tier6 unit at Night 12 mostly stays at level 1 (few grafts)", () => {
    let lv1Count = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const [u] = buildProgressedTeam(["howling_giant"], 12, createSeededRng(seed)); // Tier6
      if (u!.level === 1) lv1Count++;
    }
    // 70%以上がLv1のはず（lambda≈0.33）
    expect(lv1Count).toBeGreaterThan(70);
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
    latestGreedyArchetypes = archetypes;
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

  it("positions discovered compositions without crashing", { timeout: 30_000 }, () => {
    expect(positioned.size).toBe(archetypes.length);
    for (const arch of archetypes) {
      const positionedIds = positioned.get(arch.name);
      expect(positionedIds, `${arch.name} missing positioned result`).toBeDefined();
      expect(positionedIds).toHaveLength(arch.unitIds.length);
      expect(new Set(positionedIds).size, `${arch.name} positioned duplicates`).toBe(
        arch.unitIds.length,
      );
    }
  });
});

// ── Night-varying バランス ──

describe("cross-night balance", () => {
  const NIGHT_CHECKPOINTS = [3, 5, 7, 9, 12, 15, 18] as const;
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
        // 0.90 = SAP-canonical 強ユニット（例: Penguin/ash_fungus の late-game 累積バフ）を許容。
        // 真に壊れた 95%+ は引き続き検知される。
        expect(winRate, `${id} at night ${night}`).toBeLessThan(0.9);
        expect(winRate, `${id} at night ${night}`).toBeGreaterThan(0.1);
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

// ── GA構成発見 ──

function collectNightGaAlerts(night: number, topTeams: readonly GaRankedTeam[]): string[] {
  const breakageAlerts: string[] = [];
  for (const team of topTeams) {
    if (team.fitness > 0.9) {
      breakageAlerts.push(
        `Night ${night} CRITICAL: ${team.teamIds.join(",")} fitness=${(team.fitness * 100).toFixed(1)}%`,
      );
    } else if (team.fitness > 0.8) {
      breakageAlerts.push(
        `Night ${night} WARNING: ${team.teamIds.join(",")} fitness=${(team.fitness * 100).toFixed(1)}%`,
      );
    }
  }
  return breakageAlerts;
}

function gaTeamScore(team: GaRankedTeam): number {
  return team.adjustedFitness;
}

async function runNightGaCheckpoint(night: number): Promise<{
  poolSize: number;
  topTeams: GaRankedTeam[];
  breakageAlerts: string[];
}> {
  const poolSize = new Set(getShopPool(night)).size;
  const seeds = [night * 1000 + 42, night * 1000 + 137];
  const allTeams: GaRankedTeam[] = [];

  for (const seed of seeds) {
    const result = await runGeneticAlgorithm(
      {
        populationSize: 100,
        generations: 50,
        trialsPerEval: 50,
        eliteCount: 10,
        mutationRate: 0.15,
        tournamentSize: 5,
        refinementTrials: 500,
        refinementTopK: 5,
        night,
        baseSeed: seed,
      },
      gaWorkerPool,
    );
    allTeams.push(...result.topTeams);
  }

  const seen = new Map<string, GaRankedTeam>();
  for (const team of allTeams) {
    const key = [...team.teamIds].sort().join(",");
    const existing = seen.get(key);
    if (!existing || gaTeamScore(team) > gaTeamScore(existing)) seen.set(key, team);
  }
  const topTeams = [...seen.values()].sort((a, b) => gaTeamScore(b) - gaTeamScore(a)).slice(0, 5);
  return { poolSize, topTeams, breakageAlerts: collectNightGaAlerts(night, topTeams) };
}

describe("GA composition discovery", () => {
  let gaResult: GaResult;
  let greedyArchetypes: readonly DiscoveredArchetype[];

  beforeAll(async () => {
    gaResult = await runGeneticAlgorithm(
      {
        populationSize: 200,
        generations: 100,
        trialsPerEval: 50,
        eliteCount: 20,
        mutationRate: 0.15,
        tournamentSize: 5,
        refinementTrials: 500,
        refinementTopK: 10,
        night: 12,
        baseSeed: 777,
      },
      gaWorkerPool,
    );

    // グリーディ発見（比較用に軽量実行）
    const trials = runRandomTrials(10_000, 12, 500);
    const synergies = analyzePairSynergies(
      trials.teamTrials,
      trials.unitPerformance,
      trials.winRate,
    );
    greedyArchetypes = discoverArchetypes(synergies, trials.unitPerformance);

    // Novelty判定: グリーディ構成との Jaccard > 0.6 で既知とみなす
    const topTeams = gaResult.topTeams.map((team) => {
      const isKnown = greedyArchetypes.some(
        (arch) => jaccardSimilarity(team.teamIds, arch.unitIds) > 0.6,
      );
      return { ...team, novelty: !isKnown };
    });

    const breakageAlerts: string[] = [];
    for (const team of topTeams) {
      if (team.fitness > 0.9) {
        breakageAlerts.push(
          `CRITICAL: ${team.teamIds.join(",")} fitness=${(team.fitness * 100).toFixed(1)}%`,
        );
      } else if (team.fitness > 0.8) {
        breakageAlerts.push(
          `WARNING: ${team.teamIds.join(",")} fitness=${(team.fitness * 100).toFixed(1)}%`,
        );
      }
    }

    const lastGen = gaResult.generationStats[gaResult.generationStats.length - 1];
    const convergenceGen = lastGen && lastGen.diversity < 0.1 ? lastGen.generation : null;

    collector.setGaDiscovery({
      topTeams: topTeams.map((t) => ({
        teamIds: [...t.teamIds],
        fitness: t.fitness,
        adjustedFitness: t.adjustedFitness,
        fitnessCI95: [t.fitnessCI95[0], t.fitnessCI95[1]],
        viability: { ...t.viability },
        novelty: t.novelty,
      })),
      generationStats: gaResult.generationStats.map((s) => ({ ...s })),
      totalBattles: gaResult.totalBattles,
      convergenceGeneration: convergenceGen,
      breakageAlerts,
    });
    latestGaTopTeams = topTeams;
  }, 300_000);

  it("GA converges: best fitness improves over generations", () => {
    const stats = gaResult.generationStats;
    expect(stats.length).toBeGreaterThan(0);
    const first = stats[0]!;
    const last = stats[stats.length - 1]!;
    expect(last.bestFitness).toBeGreaterThanOrEqual(first.bestFitness);
  });

  it("top team fitness has reasonable CI width", () => {
    for (const team of gaResult.topTeams) {
      const ciWidth = team.fitnessCI95[1] - team.fitnessCI95[0];
      expect(ciWidth, `CI too wide for ${team.teamIds.join(",")}`).toBeLessThan(0.08);
    }
  });

  it("flags extreme breakage in report (informational)", () => {
    const broken = gaResult.topTeams.filter((t) => t.fitness >= 0.95);
    if (broken.length > 0) {
      console.warn(
        `GA found ${broken.length} potentially broken composition(s):`,
        broken.map((t) => `${t.teamIds.join(",")} (${(t.fitness * 100).toFixed(1)}%)`),
      );
    }
    // GA finding broken combos is a success — assert the report captured them
    expect(gaResult.topTeams.length).toBeGreaterThan(0);
  });

  it("discovers at least one composition", () => {
    expect(gaResult.topTeams.length).toBeGreaterThan(0);
  });

  it("all teams have exactly 5 unique members", () => {
    for (const team of gaResult.topTeams) {
      expect(team.teamIds.length).toBe(5);
      expect(new Set(team.teamIds).size).toBe(5);
    }
  });
});

// ── Night横断GA ──

describe("cross-night GA", () => {
  const NIGHT_CHECKPOINTS = [3, 5, 7, 9, 12, 15, 18] as const;

  it("discovers strongest compositions at each night checkpoint", async () => {
    for (const night of NIGHT_CHECKPOINTS) {
      const { poolSize, topTeams, breakageAlerts } = await runNightGaCheckpoint(night);
      if (night === 12) latestNightGaTopTeams = topTeams;
      if (breakageAlerts.length > 0) {
        console.warn(`Night ${night} GA breakage:`, breakageAlerts);
      }

      collector.addNightGa({
        night,
        poolSize,
        topTeams: topTeams.map((t) => ({
          teamIds: [...t.teamIds],
          fitness: t.fitness,
          adjustedFitness: t.adjustedFitness,
          fitnessCI95: [t.fitnessCI95[0], t.fitnessCI95[1]],
          viability: { ...t.viability },
          novelty: t.novelty,
        })),
        breakageAlerts,
      });

      expect(topTeams.length).toBeGreaterThan(0);
    }
  }, 300_000);
});

// ── メタ健全性分析 ──

describe("meta health analysis", () => {
  function metaCandidateToEntry(candidate: MetaCandidate) {
    return {
      name: candidate.name,
      unitIds: [...candidate.unitIds],
      sources: [...candidate.sources],
      greedyRank: candidate.greedyRank,
      gaFitness: candidate.gaFitness,
      nightGaFitness: candidate.nightGaFitness,
      reachabilityScore: candidate.reachabilityScore,
      viability: { ...candidate.viability },
    };
  }

  it(
    "produces valid meta analysis from the integrated candidate frontier",
    { timeout: 120_000 },
    () => {
      expect(latestGreedyArchetypes.length).toBeGreaterThan(0);
      expect(latestGaTopTeams.length).toBeGreaterThan(0);
      expect(latestNightGaTopTeams.length).toBeGreaterThan(0);

      const candidates = buildMetaCandidateFrontier({
        greedyArchetypes: latestGreedyArchetypes,
        gaTopTeams: latestGaTopTeams,
        nightGaTopTeams: latestNightGaTopTeams,
      });
      collector.setMetaCandidates(candidates.map(metaCandidateToEntry));

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.some((candidate) => candidate.sources.includes("greedy"))).toBe(true);
      expect(candidates.some((candidate) => candidate.sources.includes("ga"))).toBe(true);
      expect(candidates.some((candidate) => candidate.sources.includes("night-ga"))).toBe(true);

      const positioned = positionArchetypes(candidates, 12, 900, 20);
      allMatchupEntries.length = 0;

      const names = [...positioned.keys()];
      const TRIALS = 500;

      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const a = names[i]!;
          const b = names[j]!;
          const r = runMatchup(
            positioned.get(a)!,
            positioned.get(b)!,
            TRIALS,
            (i + 1) * 10_000 + j,
            12,
            true,
          );
          const aRate = r.aWins / r.trials;
          const warnings: string[] = [];
          if (aRate > 0.8 || aRate < 0.2)
            warnings.push(`IMBALANCE: ${aRate > 0.5 ? a : b} dominates`);
          if (r.avgFrameCount < 5) warnings.push("STOMP: battles too short");
          if (r.avgFrameCount > 80) warnings.push("STALL: battles too long");

          const entry: MatchupEntry = {
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
          };
          collector.addMatchup(entry);
          allMatchupEntries.push(entry);
        }
      }

      expect(allMatchupEntries.length).toBeGreaterThan(0);

      const meta = analyzeMetaHealth(allMatchupEntries);
      collector.setMetaAnalysis(meta);

      expect(meta.teamLabels.length).toBeGreaterThan(0);
      expect(meta.payoffMatrix.length).toBe(meta.teamLabels.length);
      for (const row of meta.payoffMatrix) {
        expect(row.length).toBe(meta.teamLabels.length);
      }

      expect(meta.nashEquilibrium.length).toBe(meta.teamLabels.length);
      const probSum = meta.nashEquilibrium.reduce((s, e) => s + e.probability, 0);
      expect(probSum).toBeCloseTo(1, 2);

      expect(meta.cyclicityScore).toBeGreaterThanOrEqual(0);
      expect(meta.cyclicityScore).toBeLessThanOrEqual(1);

      expect(meta.equilibriumEntropy).toBeGreaterThanOrEqual(0);
      expect(meta.equilibriumEntropy).toBeLessThanOrEqual(meta.maxEntropy + 0.01);

      expect(["healthy", "slightly_skewed", "dominant_meta", "degenerate"]).toContain(
        meta.healthVerdict,
      );
      expect(meta.verdictReasons.length).toBeGreaterThan(0);
    },
  );
});
