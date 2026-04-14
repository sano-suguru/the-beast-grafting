import { UNITS } from "../../shared/data/units";
import type { RegularUnitId } from "../../shared/types";
import type { UnitPerformance } from "./sim-types";
import { createSeededRng } from "../rng";
import { UNIT_PROFILES } from "./sim-synergy";
import { generateSimTeam } from "./sim-team-gen";
import { optimizePositions } from "./sim-position";
import { runMatchup, runRandomTrials } from "./sim-runner";
import { ARCHETYPES, getPositionedArchetypes } from "./sim-archetypes";
import { createUnit } from "../helpers";
import { simulateBattle } from "../battle";
import { buildProgressedUnit } from "./sim-progression";
import { SimReportCollector, perfMapToRecord, perfToRecord } from "./sim-report-collect";
import { writeSimReport } from "./sim-report-write";

const collector = new SimReportCollector();

afterAll(() => {
  writeSimReport(collector.build());
});

// ── データ整合性 ──

describe("sim data integrity", () => {
  it("UNIT_PROFILES covers all units in UNITS", () => {
    const unitIds = Object.keys(UNITS) as RegularUnitId[];
    for (const id of unitIds) {
      expect(UNIT_PROFILES[id], `missing profile for ${id}`).toBeDefined();
    }
  });

  it("UNIT_PROFILES contains no IDs absent from UNITS", () => {
    for (const id of Object.keys(UNIT_PROFILES)) {
      expect(UNITS[id as RegularUnitId], `${id} not in UNITS`).toBeDefined();
    }
  });

  it("all archetype units exist in UNITS", () => {
    for (const [name, ids] of Object.entries(ARCHETYPES)) {
      for (const id of ids) {
        expect(UNITS[id as RegularUnitId], `${name}: ${id} not in UNITS`).toBeDefined();
      }
    }
  });

  it("all archetypes have exactly 5 units", () => {
    for (const [name, ids] of Object.entries(ARCHETYPES)) {
      expect(ids, name).toHaveLength(5);
    }
  });
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

  it("synergy boost increases co-occurrence", () => {
    let pairCount = 0;
    const total = 200;
    for (let seed = 1; seed <= total; seed++) {
      const team = generateSimTeam(12, createSeededRng(seed));
      const hasAltar = team.includes("altar");
      const hasSpawner = team.some((id) => UNIT_PROFILES[id].tags.includes("spawner"));
      if (hasAltar && hasSpawner) pairCount++;
    }
    console.log(`altar + spawner co-occurrence: ${pairCount}/${total}`);
    expect(pairCount).toBeGreaterThan(0);
  });
});

// ── ポジション最適化 ──

describe("optimizePositions", () => {
  /** 入力順序 → バトル順序に変換 */
  const toBattle = (arr: RegularUnitId[]) => [...arr].reverse();

  it("places support at battle position 1", () => {
    const battle = toBattle(optimizePositions(["rat", "parasite", "bat", "martyr", "crow"]));
    expect(battle[1]).toBe("parasite");
  });

  it("places brains at position 2 when support exists", () => {
    const battle = toBattle(optimizePositions(["brains", "eye", "rat", "bat", "crow"]));
    expect(battle[1]).toBe("eye");
    expect(battle[2]).toBe("brains");
  });

  it("places brains at position 1 when no support exists", () => {
    const battle = toBattle(optimizePositions(["brains", "rat", "bat", "martyr", "crow"]));
    expect(battle[1]).toBe("brains");
  });

  it("places front-tagged unit at position 0", () => {
    const battle = toBattle(optimizePositions(["howling_giant", "rat", "bat", "martyr", "crow"]));
    expect(battle[0]).toBe("howling_giant");
  });

  it("prefers tankier front units", () => {
    const battle = toBattle(optimizePositions(["leech", "howling_giant", "bat", "rat", "crow"]));
    expect(battle[0]).toBe("howling_giant");
  });

  it("handles teams smaller than 5", () => {
    const battle = toBattle(optimizePositions(["parasite", "rat", "bat"]));
    expect(battle).toHaveLength(3);
    expect(battle[1]).toBe("parasite");
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
  it("optimized positions win more than shuffled", () => {
    const TRIALS = 300;
    let optimizedWins = 0;
    let shuffledWins = 0;

    for (let i = 0; i < TRIALS; i++) {
      const rng = createSeededRng(i + 1);
      const team = generateSimTeam(12, rng);

      const optimized = optimizePositions(team);
      const shuffled = [...team];
      // Fisher-Yates で再現可能なシャッフル
      const sRng = createSeededRng(i * 7 + 3);
      for (let j = shuffled.length - 1; j > 0; j--) {
        const k = Math.floor(sRng.next() * (j + 1));
        [shuffled[j]!, shuffled[k]!] = [shuffled[k]!, shuffled[j]!];
      }

      const enemy = generateSimTeam(12, createSeededRng(i * 3 + 100));
      const enemyOpt = optimizePositions(enemy);

      const r1 = simulateBattle(
        optimized.map((id) => createUnit(id)),
        {
          teamName: "[SIM]",
          teamType: "同業者",
          units: enemyOpt.map((id) => createUnit(id)),
          night: null,
          life: null,
          trophy: null,
        },
        12,
        i + 5000,
      );
      const r2 = simulateBattle(
        shuffled.map((id) => createUnit(id)),
        {
          teamName: "[SIM]",
          teamType: "同業者",
          units: enemyOpt.map((id) => createUnit(id)),
          night: null,
          life: null,
          trophy: null,
        },
        12,
        i + 5000,
      );

      if (r1.result === "WIN") optimizedWins++;
      if (r2.result === "WIN") shuffledWins++;
    }

    const optRate = optimizedWins / TRIALS;
    const shufRate = shuffledWins / TRIALS;
    collector.setPositionOpt({
      optimizedWinRate: optRate,
      shuffledWinRate: shufRate,
      deltaPp: (optRate - shufRate) * 100,
      trials: TRIALS,
    });
    expect(optRate).toBeGreaterThanOrEqual(shufRate);
  });
});

// ── アーキタイプ対戦 ──

describe("archetype matchups", () => {
  const positioned = getPositionedArchetypes();
  const names = [...positioned.keys()];
  const TRIALS = 500;

  it("runs all-vs-all without crashing", { timeout: 15_000 }, () => {
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = names[i]!;
        const b = names[j]!;
        const r = runMatchup(positioned.get(a)!, positioned.get(b)!, TRIALS, (i + 1) * 1000 + j);
        const aRate = r.aWins / r.trials;
        expect(r.trials).toBe(TRIALS);
        expect(r.aWins + r.bWins + r.draws).toBe(TRIALS);

        const warnings: string[] = [];
        if (aRate > 0.85 || aRate < 0.15)
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

// ── ランダムバランス ──

describe("random balance", () => {
  it("mirror win rate is roughly even", () => {
    const r = runRandomTrials(1000, 12, 42);
    collector.addRandomBalance({
      night: 12,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      trials: r.trials,
      winRate: r.winRate,
      avgFrameCount: r.avgFrameCount,
      unitPerformance: perfMapToRecord(r.unitPerformance),
      uniqueUnitCount: r.unitPerformance.size,
    });
    expect(r.winRate).toBeGreaterThan(0.35);
    expect(r.winRate).toBeLessThan(0.65);
  });

  it("no unit dominates: per-unit win rate within bounds", () => {
    const r = runRandomTrials(2000, 12, 100);
    const MIN_APPEARANCES = 100;

    for (const [id, perf] of r.unitPerformance) {
      if (perf.appearances < MIN_APPEARANCES) continue;
      const winRate = perf.wins / perf.appearances;
      expect(winRate, `${id} too strong`).toBeLessThan(0.8);
      expect(winRate, `${id} too weak`).toBeGreaterThan(0.2);
    }

    collector.addRandomBalance({
      night: 12,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      trials: r.trials,
      winRate: r.winRate,
      avgFrameCount: r.avgFrameCount,
      unitPerformance: perfMapToRecord(r.unitPerformance),
      uniqueUnitCount: r.unitPerformance.size,
    });
  });

  it("unit diversity: most units appear at least once", () => {
    const r = runRandomTrials(500, 12, 200);
    const poolSize = Object.keys(UNITS).length;
    expect(r.unitPerformance.size).toBeGreaterThan(poolSize * 0.7);
  });
});

// ── Night-varying バランス ──

describe("cross-night balance", () => {
  const NIGHT_CHECKPOINTS = [3, 5, 7, 9, 12] as const;
  const TRIALS_PER_NIGHT = 500;

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
        if (perf.appearances < 50) continue;
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
        expect(winRate, `${id} at night ${night}`).toBeLessThan(0.95);
        expect(winRate, `${id} at night ${night}`).toBeGreaterThan(0.05);
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
