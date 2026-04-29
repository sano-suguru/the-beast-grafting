import { createUnit } from "../helpers";
import { createSeededRng } from "../rng";
import { applySimShopEffects } from "./sim-shop-effects";
import { generateSimTeam, generateSimTeamWithHistory } from "./sim-team-gen";
import { runRandomTrials } from "./sim-runner";
import { TIER_APPEAR_NIGHT } from "./sim-types";
import { analyzePairSynergies } from "./sim-pair-synergy";
import { discoverArchetypes } from "./sim-archetype-greedy";
import { computeReachabilityScore } from "./sim-reachability";
import { estimateTeamViability } from "./sim-run-viability";

describe("applySimShopEffects fidelity", () => {
  test("revenant buffs the strongest carry over owned turns", () => {
    // Bernoulli sampling: use multiple seeds to test both existence and the carry-only invariant
    let carryGotBuff = false;
    for (let seed = 1; seed <= 50; seed++) {
      const revenant = createUnit("revenant");
      const carry = createUnit("hundred_arms");
      const filler = createUnit("rat");
      const team = [revenant, carry, filler];
      applySimShopEffects(team, 9, createSeededRng(seed));
      if (carry.buffAtk + carry.buffHp > 0) {
        carryGotBuff = true;
        // revenant targets selectCarryTargets (not random), so filler must be 0
        expect(filler.buffAtk + filler.buffHp).toBe(0);
      }
    }
    expect(carryGotBuff).toBe(true);
  });

  test("hanged_man buffs the strongest carry over owned turns", () => {
    const hangedMan = createUnit("hanged_man");
    const carry = createUnit("howling_giant");
    const filler = createUnit("rat");
    const team = [hangedMan, carry, filler];

    applySimShopEffects(team, 12, createSeededRng(2));

    expect(carry.buffAtk).toBeGreaterThan(0);
    expect(carry.buffHp).toBeGreaterThan(0);
    expect(filler.buffAtk + filler.buffHp).toBe(0);
  });

  test("graft_scion converts stocked items into carry stats", () => {
    // Lv2: worm_apple_2 (+2/+2) > avg food → delta positive → carry gets buff
    let carryGotBuff = false;
    for (let seed = 1; seed <= 50; seed++) {
      const graftScion = { ...createUnit("graft_scion"), level: 2 };
      const carry = createUnit("hundred_arms");
      const filler = createUnit("rat");
      const team = [graftScion, carry, filler];
      applySimShopEffects(team, 9, createSeededRng(seed));
      if (carry.buffAtk + carry.buffHp > 0) {
        carryGotBuff = true;
        break;
      }
    }
    expect(carryGotBuff).toBe(true);
  });

  test("tainted_placenta converts extra blood into late carry stats", () => {
    const placenta = createUnit("tainted_placenta");
    const carry = createUnit("hundred_arms");
    const filler = createUnit("rat");
    const team = [placenta, carry, filler];

    applySimShopEffects(team, 12, createSeededRng(4));

    expect(carry.buffAtk).toBeGreaterThan(0);
    expect(carry.buffHp).toBeGreaterThan(0);
    expect(carry.buffAtk + carry.buffHp + filler.buffAtk + filler.buffHp).toBeGreaterThan(0);
  });

  test("bone_tree adds extra value to late stat item buys", () => {
    const boneTree = { ...createUnit("bone_tree"), level: 2 };
    const carry = createUnit("howling_giant");
    const filler = createUnit("rat");
    const team = [boneTree, carry, filler];
    const controlTeam = [createUnit("howling_giant"), createUnit("rat")];

    applySimShopEffects(team, 18, createSeededRng(5));
    applySimShopEffects(controlTeam, 18, createSeededRng(5));

    expect(carry.buffAtk).toBeGreaterThan(0);
    expect(carry.buffHp).toBeGreaterThan(0);
    const withCatTotal = team.reduce((sum, unit) => sum + unit.buffAtk + unit.buffHp, 0);
    const controlTotal = controlTeam.reduce((sum, unit) => sum + unit.buffAtk + unit.buffHp, 0);
    expect(withCatTotal).toBeGreaterThan(controlTotal);
  });

  test("bone_tree baseline bonus stays bounded after generic progression overlap", () => {
    let totalDelta = 0;
    const samples = 50;

    for (let seed = 1; seed <= samples; seed++) {
      const boneTree = { ...createUnit("bone_tree"), level: 2 };
      const carry = createUnit("howling_giant");
      const filler = createUnit("rat");
      const team = [boneTree, carry, filler];
      const controlTeam = [createUnit("howling_giant"), createUnit("rat")];

      applySimShopEffects(team, 18, createSeededRng(seed));
      applySimShopEffects(controlTeam, 18, createSeededRng(seed));

      const withCatTotal = team.reduce((sum, unit) => sum + unit.buffAtk + unit.buffHp, 0);
      const controlTotal = controlTeam.reduce((sum, unit) => sum + unit.buffAtk + unit.buffHp, 0);
      totalDelta += withCatTotal - controlTotal;
    }

    const avgDelta = totalDelta / samples;
    expect(avgDelta).toBeGreaterThan(0);
    expect(avgDelta).toBeLessThan(12);
  });

  test("tainted_placenta spends only part of its blood on food conversion", () => {
    let totalCarryBuff = 0;
    const samples = 50;

    for (let seed = 1; seed <= samples; seed++) {
      const placenta = createUnit("tainted_placenta");
      const carry = createUnit("hundred_arms");
      const filler = createUnit("rat");
      const team = [placenta, carry, filler];

      applySimShopEffects(team, 12, createSeededRng(seed));
      totalCarryBuff += carry.buffAtk + carry.buffHp;
    }

    const avgCarryBuff = totalCarryBuff / samples;
    expect(avgCarryBuff).toBeGreaterThan(0.5);
    expect(avgCarryBuff).toBeLessThan(6);
  });

  test("high-level beggar converts sell blood into team stats", () => {
    // distributeBuffRandomly は全ユニットへ等分するためfillerにも分配される
    let teamGotBuff = false;
    for (let seed = 1; seed <= 50; seed++) {
      const beggar = { ...createUnit("beggar"), level: 3 };
      const carry = createUnit("hundred_arms");
      const filler = createUnit("rat");
      const team = [beggar, carry, filler];
      applySimShopEffects(team, 9, createSeededRng(seed));
      const total = team.reduce((s, u) => s + u.buffAtk + u.buffHp, 0);
      if (total > 0) {
        teamGotBuff = true;
        break;
      }
    }
    expect(teamGotBuff).toBe(true);
  });

  test("graft_scion replacement model keeps carry buff bounded", () => {
    let totalCarryBuff = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const graftScion = { ...createUnit("graft_scion"), level: 2 };
      const carry = createUnit("hundred_arms");
      const filler = createUnit("rat");
      const team = [graftScion, carry, filler];
      applySimShopEffects(team, 12, createSeededRng(seed));
      totalCarryBuff += carry.buffAtk + carry.buffHp;
    }
    const avg = totalCarryBuff / 50;
    expect(avg).toBeGreaterThan(0);
    expect(avg).toBeLessThan(15);
  });

  test("chalice contributes positive team buff via differential model", () => {
    let teamGotBuff = false;
    for (let seed = 1; seed <= 50; seed++) {
      const chalice = { ...createUnit("chalice"), level: 2 };
      const carry = createUnit("hundred_arms");
      const filler = createUnit("rat");
      const team = [chalice, carry, filler];
      applySimShopEffects(team, 9, createSeededRng(seed));
      const total = team.reduce((s, u) => s + u.buffAtk + u.buffHp, 0);
      if (total > 0) {
        teamGotBuff = true;
        break;
      }
    }
    expect(teamGotBuff).toBe(true);
  });

  test("chalice average buff stays bounded (one-shot, not per-turn)", () => {
    let totalTeamBuff = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const chalice = { ...createUnit("chalice"), level: 2 };
      const carry = createUnit("hundred_arms");
      const filler = createUnit("rat");
      const team = [chalice, carry, filler];
      applySimShopEffects(team, 12, createSeededRng(seed));
      totalTeamBuff += team.reduce((s, u) => s + u.buffAtk + u.buffHp, 0);
    }
    const avg = totalTeamBuff / 50;
    expect(avg).toBeLessThan(15);
  });
});

describe("generateSimTeam encounter sampling", () => {
  test("still produces exactly 5 unique units", () => {
    const team = generateSimTeam(12, createSeededRng(42));
    expect(team).toHaveLength(5);
    expect(new Set(team).size).toBe(5);
  });

  test("favors earlier-tier units over tier-6 units at night 12", () => {
    let tier1Count = 0;
    let tier6Count = 0;

    for (let seed = 1; seed <= 200; seed++) {
      const team = generateSimTeam(12, createSeededRng(seed));
      for (const id of team) {
        const unit = createUnit(id);
        if (unit.tier === 1) tier1Count++;
        if (unit.tier === 6) tier6Count++;
      }
    }

    expect(tier1Count).toBeGreaterThan(tier6Count);
  });
});

describe("UnitPerformance fidelity distributions (Night 12, N=2000)", () => {
  let unitPerf: ReturnType<typeof runRandomTrials>["unitPerformance"];

  beforeAll(() => {
    const result = runRandomTrials(2000, 12, 99);
    unitPerf = result.unitPerformance;
  }, 30000);

  test("avgLevel は [1.0, 2.0] 内に収まる", () => {
    for (const [, perf] of unitPerf) {
      if (perf.appearances < 50) continue;
      expect(perf.avgLevel).toBeGreaterThanOrEqual(1.0);
      expect(perf.avgLevel).toBeLessThanOrEqual(2.0);
    }
  });

  test("Lv1 + Lv2 比率が 0.6 以上（Night 12 で Lv3 は少数）", () => {
    for (const [, perf] of unitPerf) {
      if (perf.appearances < 50) continue;
      const lv12ratio = perf.levelDistribution[0] + perf.levelDistribution[1];
      expect(lv12ratio).toBeGreaterThanOrEqual(0.6);
    }
  });

  test("Tier 1 ユニットの equipRate は Tier 6 より高い", () => {
    const tier1Units = [...unitPerf.values()].filter((p) => p.tier === 1 && p.appearances >= 50);
    const tier6Units = [...unitPerf.values()].filter((p) => p.tier === 6 && p.appearances >= 20);
    if (tier1Units.length === 0 || tier6Units.length === 0) return;
    const avgTier1Equip = tier1Units.reduce((s, p) => s + p.equipRate, 0) / tier1Units.length;
    const avgTier6Equip = tier6Units.reduce((s, p) => s + p.equipRate, 0) / tier6Units.length;
    expect(avgTier1Equip).toBeGreaterThan(avgTier6Equip);
  });

  test("avgOwnedTurns は tierAppearNight から night の範囲内", () => {
    for (const [, perf] of unitPerf) {
      if (perf.appearances < 50) continue;
      const maxOwnable = 12 - (TIER_APPEAR_NIGHT[perf.tier as 1 | 2 | 3 | 4 | 5 | 6] ?? 1) + 1;
      expect(perf.avgOwnedTurns).toBeGreaterThanOrEqual(1);
      expect(perf.avgOwnedTurns).toBeLessThanOrEqual(maxOwnable);
    }
  });

  test("avgGraftCount は team budget 内（平均 1.2 以下）", () => {
    for (const [, perf] of unitPerf) {
      if (perf.appearances < 50) continue;
      expect(perf.avgGraftCount).toBeLessThanOrEqual(1.2);
    }
  });
});

describe("generateSimTeamWithHistory Phase2 fidelity (Night 12)", () => {
  const NIGHT = 12;
  const TRIALS = 500;

  test("5体完成率は 0.60–0.97 の範囲内", () => {
    let completions = 0;
    for (let seed = 1; seed <= TRIALS; seed++) {
      const { ids } = generateSimTeamWithHistory(NIGHT, createSeededRng(seed));
      if (ids.length === 5) completions++;
    }
    const rate = completions / TRIALS;
    expect(rate).toBeGreaterThanOrEqual(0.6);
    expect(rate).toBeLessThanOrEqual(0.97);
  });

  test("roster は TEAM_SIZE を超えない", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { ids } = generateSimTeamWithHistory(NIGHT, createSeededRng(seed));
      expect(ids.length).toBeLessThanOrEqual(5);
    }
  });

  test("夜あたり購入数の平均は期待レンジ内", () => {
    let totalBought = 0;
    for (let seed = 1; seed <= TRIALS; seed++) {
      const { history } = generateSimTeamWithHistory(NIGHT, createSeededRng(seed));
      for (const log of history.nights) {
        totalBought += log.bought.length;
      }
    }
    const avgBought = totalBought / TRIALS;
    expect(avgBought).toBeGreaterThanOrEqual(3.0);
    expect(avgBought).toBeLessThanOrEqual(6.5);
  });
});

describe("Phase3 Bernoulli sampling fidelity (Night 9, N=300)", () => {
  const NIGHT = 9;
  const TRIALS = 300;

  test("revenant carry の buffAtk に分散がある（P90/P10 比が 1 超かつ 10 未満）", () => {
    const carryBuffs: number[] = [];
    for (let seed = 1; seed <= TRIALS; seed++) {
      const rng = createSeededRng(seed);
      const revenant = createUnit("revenant");
      const carry = createUnit("hundred_arms");
      const filler = createUnit("rat");
      const team = [revenant, carry, filler];
      applySimShopEffects(team, NIGHT, rng);
      carryBuffs.push(carry.buffAtk + carry.buffHp);
    }
    carryBuffs.sort((a, b) => a - b);
    const p10 = carryBuffs[Math.floor(TRIALS * 0.1)]!;
    const p90 = carryBuffs[Math.floor(TRIALS * 0.9)]!;
    if (p10 === 0) {
      expect(p90).toBeGreaterThan(0);
    } else {
      const ratio = p90 / p10;
      expect(ratio).toBeGreaterThan(1);
      expect(ratio).toBeLessThan(10);
    }
  });

  test("平均勝率は壊滅的にシフトしていない（wins/appearances が 0.25–0.75 の範囲）", () => {
    const result = runRandomTrials(500, NIGHT, 42);
    for (const [, perf] of result.unitPerformance) {
      if (perf.appearances < 30) continue;
      const rate = perf.wins / perf.appearances;
      expect(rate).toBeGreaterThanOrEqual(0.25);
      expect(rate).toBeLessThanOrEqual(0.75);
    }
  });
});

describe("run viability fidelity", () => {
  test("late-tier comp has lower viability than early comp at night 12", () => {
    const late = estimateTeamViability(
      ["budding_hydra", "howling_giant", "tainted_placenta", "beelzebub", "organ_grinder"],
      12,
      41,
    );
    const early = estimateTeamViability(["rat", "bat", "gut_hand", "martyr", "hound"], 12, 41);

    expect(late.arrivalNight).toBeGreaterThan(early.arrivalNight);
    expect(late.viabilityScore).toBeLessThan(early.viabilityScore);
  });

  test("correlated reachability is no more optimistic than independent reachability", () => {
    const team = [
      "budding_hydra",
      "howling_giant",
      "tainted_placenta",
      "beelzebub",
      "organ_grinder",
    ] as const;
    const viability = estimateTeamViability(team, 12, 99);
    const independent = computeReachabilityScore(team, 12);
    expect(viability.correlatedReachabilityScore).toBeLessThanOrEqual(independent + 0.05);
  });
});

describe("Phase4 reachability-aware archetype discovery (Night 12, N=3000)", () => {
  let archetypes: ReturnType<typeof discoverArchetypes>;

  beforeAll(() => {
    const result = runRandomTrials(3000, 12, 77);
    const pairs = analyzePairSynergies(result.teamTrials, result.unitPerformance, result.winRate);
    archetypes = discoverArchetypes(pairs, result.unitPerformance, 10, 12);
  }, 30000);

  test("アーキタイプが 3 件以上発見される（reachability フィルタで空集合化しない）", () => {
    expect(archetypes.length).toBeGreaterThanOrEqual(3);
  });

  test("全アーキタイプの到達性が最低ラインを超える", () => {
    for (const arch of archetypes) {
      expect(arch.reachabilityScore).toBeGreaterThanOrEqual(0.05);
      expect(arch.viability.correlatedReachabilityScore).toBeGreaterThanOrEqual(0.12);
      expect(arch.viability.viabilityScore).toBeGreaterThan(0.2);
    }
  });

  test("Tier6 ユニット 4 体以上の編成が上位 3 件に入らない", () => {
    const top3 = archetypes.slice(0, 3);
    for (const arch of top3) {
      const tier6Count = arch.unitIds.filter((id) => createUnit(id).tier === 6).length;
      expect(tier6Count).toBeLessThan(4);
    }
  });
});
