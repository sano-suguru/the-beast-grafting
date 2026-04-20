import { resolveDeaths } from "./battle-deaths";
import { createSeededRng } from "./rng";
import { makeBattleUnit, makeContext } from "./test-helpers";
import { segmentsToPlainText } from "./test-helpers";
import { MAX_BOARD_SIZE } from "./constants";
import { atLevel, HANGED_MAN, SERAPH, BEELZEBUB } from "../shared/skill-params";
import type { BattleFrame } from "../shared/types";

const logText = (f: BattleFrame) => segmentsToPlainText(f.log.segments);

describe("resolveDeaths – basic removal", () => {
  it("removes dead units (hp <= 0) from boards", () => {
    const dead = makeBattleUnit({ id: "token", hp: 0 });
    const alive = makeBattleUnit({ hp: 5 });
    const ctx = makeContext([dead, alive], []);
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.hp).toBe(5);
  });

  it("processes deaths on both sides", () => {
    const pDead = makeBattleUnit({ hp: 0 });
    const eDead = makeBattleUnit({ hp: 0 });
    const ctx = makeContext([pDead], [eDead]);
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(0);
    expect(ctx.eBoard).toHaveLength(0);
  });
});

describe("resolveDeaths – spawn on death", () => {
  it("rat death buffs a random ally (Lv1: +1/+1)", () => {
    const rat = makeBattleUnit({ id: "rat", hp: 0 });
    const ally1 = makeBattleUnit({ atk: 3, hp: 5, uid: "a1" });
    const ally2 = makeBattleUnit({ atk: 2, hp: 4, uid: "a2" });
    // rng=0 → ally1 が選ばれる
    const ctx = makeContext([rat, ally1, ally2], [], null, { next: () => 0 });
    resolveDeaths(ctx);
    // Lv1: +1/+1 (1体のみ)
    expect(ally1.atk).toBe(4);
    expect(ally1.hp).toBe(6);
    expect(ally2.atk).toBe(2); // 未バフ
    expect(ally2.hp).toBe(4);
  });

  it("hound death spawns 1/1 token", () => {
    const hound = makeBattleUnit({ id: "hound", name: "猟犬", hp: 0 });
    const ctx = makeContext([hound], []);
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.id).toBe("token");
    expect(ctx.pBoard[0]!.atk).toBe(1);
    expect(ctx.pBoard[0]!.hp).toBe(1);
  });

  it("beast death spawns 2/2 unit", () => {
    const beast = makeBattleUnit({ id: "beast", name: "腐肉獣", hp: 0 });
    const ctx = makeContext([beast], []);
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.atk).toBe(2);
    expect(ctx.pBoard[0]!.hp).toBe(2);
  });

  it("church_beast death spawns 3/3 token with isChurch", () => {
    const cb = makeBattleUnit({ id: "church_beast", name: "偽天使", hp: 0, isChurch: true });
    const ctx = makeContext([], [cb]);
    resolveDeaths(ctx);
    expect(ctx.eBoard).toHaveLength(1);
    expect(ctx.eBoard[0]!.isChurch).toBe(true);
    expect(ctx.eBoard[0]!.atk).toBe(3);
  });

  it("altar does NOT buff spawned tokens during battle (shop-only EoT effect)", () => {
    const hound = makeBattleUnit({ id: "hound", name: "猟犬", hp: 0 });
    const altar = makeBattleUnit({ id: "altar", name: "祭壇", level: 3, atk: 4, hp: 5 });
    const ctx = makeContext([hound, altar], []);
    resolveDeaths(ctx);
    const token = ctx.pBoard.find((u) => u.id === "token");
    expect(token).toBeDefined();
    expect(token!.atk).toBe(1);
    expect(token!.hp).toBe(1);
  });
});

describe("resolveDeaths – buff and equip on death", () => {
  it("squire death buffs next unit +1/+1", () => {
    const squire = makeBattleUnit({ id: "squire", name: "従騎士", hp: 0, isChurch: true });
    const next = makeBattleUnit({ atk: 3, hp: 3, isChurch: true });
    const ctx = makeContext([], [squire, next]);
    resolveDeaths(ctx);
    expect(next.atk).toBe(4);
    expect(next.hp).toBe(4);
  });

  it("priest death buffs all allies +0/+1", () => {
    const priest = makeBattleUnit({ id: "priest", name: "司祭", hp: 0 });
    const ally1 = makeBattleUnit({ hp: 4 });
    const ally2 = makeBattleUnit({ hp: 3 });
    const ctx = makeContext([priest, ally1, ally2], []);
    resolveDeaths(ctx);
    expect(ally1.hp).toBe(5);
    expect(ally2.hp).toBe(4);
  });

  it("maiden death grants corpse_wax to next unit", () => {
    const maiden = makeBattleUnit({ id: "maiden", name: "処女", hp: 0 });
    const next = makeBattleUnit({ equip: null, hp: 5 });
    const ctx = makeContext([maiden, next], []);
    resolveDeaths(ctx);
    expect(next.equip).toBe("corpse_wax");
  });
});

describe("resolveDeaths – equipment death effects", () => {
  it("maggot_nest equip spawns 1/1 token on death", () => {
    const unit = makeBattleUnit({ equip: "maggot", hp: 0 });
    const ctx = makeContext([unit], []);
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.name).toBe("巨大蛆虫");
    expect(ctx.pBoard[0]!.atk).toBe(1);
  });

  it("death_curse equip spawns 1/1 copy on death", () => {
    const unit = makeBattleUnit({ name: "テストユニット", equip: "death_curse", hp: 0 });
    const ctx = makeContext([unit], []);
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.name).toBe("テストユニット");
    expect(ctx.pBoard[0]!.atk).toBe(1);
    expect(ctx.pBoard[0]!.hp).toBe(1);
  });
});

describe("resolveDeaths – token buff synergies", () => {
  it("zealot buffs spawned tokens atk +1", () => {
    const hound = makeBattleUnit({ id: "hound", name: "猟犬", hp: 0 });
    const zealot = makeBattleUnit({ id: "zealot", name: "狂信者", atk: 2, hp: 3 });
    const ctx = makeContext([hound, zealot], []);
    resolveDeaths(ctx);
    const token = ctx.pBoard.find((u) => u.id === "token");
    expect(token).toBeDefined();
    expect(token!.atk).toBe(2); // 1 base + 1 zealot buff
  });
});

describe("resolveDeaths – beelzebub", () => {
  it("spawns 4/4 fly on ally death (Lv1)", () => {
    const dying = makeBattleUnit({ hp: 0 });
    const beelzebub = makeBattleUnit({
      id: "beelzebub",
      name: "ベルゼブブ",
      atk: 4,
      hp: 4,
      skillUses: atLevel(BEELZEBUB.uses, 1),
    });
    const ctx = makeContext([dying, beelzebub], []);
    resolveDeaths(ctx);
    const fly = ctx.pBoard.find((u) => u.name === "腐肉の蠅");
    expect(fly).toBeDefined();
    expect(fly!.atk).toBe(4);
    expect(fly!.hp).toBe(4);
  });

  it("fly spawn limited by skillUses (Lv1: max 3)", () => {
    const uses = atLevel(BEELZEBUB.uses, 1);
    const units = [
      makeBattleUnit({ id: "eye", hp: 0 }),
      makeBattleUnit({ id: "eye", hp: 0 }),
      makeBattleUnit({ id: "eye", hp: 0 }),
      makeBattleUnit({ id: "eye", hp: 0 }),
      makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", atk: 4, hp: 4, skillUses: uses }),
    ];
    const ctx = makeContext(units, []);
    resolveDeaths(ctx);
    const flies = ctx.pBoard.filter((u) => u.name === "腐肉の蠅");
    expect(flies.length).toBe(uses);
  });

  it("two beelzebubs spawn independently, limited by board size", () => {
    const uses = atLevel(BEELZEBUB.uses, 1);
    const units = [
      makeBattleUnit({ hp: 0 }),
      makeBattleUnit({ hp: 0 }),
      makeBattleUnit({ hp: 0 }),
      makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ1", atk: 4, hp: 4, skillUses: uses }),
      makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ2", atk: 4, hp: 4, skillUses: uses }),
    ];
    const ctx = makeContext(units, []);
    resolveDeaths(ctx);
    const flies = ctx.pBoard.filter((u) => u.name === "腐肉の蠅");
    expect(flies.length).toBeLessThanOrEqual(3);
  });

  it("brains behind beelzebub spawns 2 flies per faint", () => {
    const dying = makeBattleUnit({ hp: 0 });
    const beelzebub = makeBattleUnit({
      id: "beelzebub",
      name: "ベルゼブブ",
      atk: 4,
      hp: 4,
      skillUses: atLevel(BEELZEBUB.uses, 1),
    });
    const brains = makeBattleUnit({ id: "brains", name: "双子脳", atk: 6, hp: 4 });
    const ctx = makeContext([dying, beelzebub, brains], []);
    resolveDeaths(ctx);
    const flies = ctx.pBoard.filter((u) => u.name === "腐肉の蠅");
    expect(flies.length).toBe(2);
  });

  it("skillUses limits total spawns across multiple deaths", () => {
    const uses = atLevel(BEELZEBUB.uses, 1);
    const d1 = makeBattleUnit({ id: "eye", hp: 0, atk: 5 });
    const d2 = makeBattleUnit({ id: "eye", hp: 0, atk: 3 });
    const d3 = makeBattleUnit({ id: "eye", hp: 0, atk: 1 });
    const beelzebub = makeBattleUnit({
      id: "beelzebub",
      name: "ベルゼブブ",
      atk: 4,
      hp: 4,
      skillUses: uses,
    });
    const ctx = makeContext([d1, d2, d3, beelzebub], []);
    resolveDeaths(ctx);
    const flies = ctx.pBoard.filter((u) => u.name === "腐肉の蠅");
    expect(flies.length).toBe(uses);
  });

  it("token (zombie fly) death does not trigger beelzebub spawns (SAP準拠)", () => {
    const token = makeBattleUnit({ id: "token", name: "腐肉の蠅", hp: 0 });
    const beelzebub = makeBattleUnit({
      id: "beelzebub",
      name: "ベルゼブブ",
      atk: 4,
      hp: 4,
      skillUses: atLevel(BEELZEBUB.uses, 1),
    });
    const ctx = makeContext([token, beelzebub], []);
    resolveDeaths(ctx);
    expect(ctx.pBoard.filter((u) => u.name === "腐肉の蠅")).toHaveLength(0);
  });

  it("player and enemy fly counters are independent", () => {
    const uses = atLevel(BEELZEBUB.uses, 1);
    const pDead = makeBattleUnit({ hp: 0 });
    const pBeelzebub = makeBattleUnit({
      id: "beelzebub",
      name: "ベルゼブブ",
      atk: 4,
      hp: 4,
      skillUses: uses,
    });
    const eDead = makeBattleUnit({ hp: 0 });
    const eBeelzebub = makeBattleUnit({
      id: "beelzebub",
      name: "敵ベルゼブブ",
      atk: 4,
      hp: 4,
      skillUses: uses,
    });
    const ctx = makeContext([pDead, pBeelzebub], [eDead, eBeelzebub]);
    resolveDeaths(ctx);
    expect(ctx.pBoard.filter((u) => u.name === "腐肉の蠅").length).toBeGreaterThanOrEqual(1);
    expect(ctx.eBoard.filter((u) => u.name === "腐肉の蠅").length).toBeGreaterThanOrEqual(1);
  });

  it("beelzebub does not spawn fly when it is the one dying", () => {
    const beelzebub = makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", atk: 4, hp: 0 });
    const ctx = makeContext([beelzebub], []);
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(0);
  });

  it("does not spawn fly when beelzebub has hp <= 0 but is not yet spliced", () => {
    // unitA(atk=5) dies first → beelzebub(atk=2, hp=0) still on board → must NOT spawn
    const unitA = makeBattleUnit({ id: "token", atk: 5, hp: 0 });
    const beelzebub = makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", atk: 2, hp: 0 });
    const ctx = makeContext([unitA, beelzebub], []);
    resolveDeaths(ctx);
    expect(ctx.pBoard.filter((u) => u.name === "腐肉の蠅")).toHaveLength(0);
  });
});

describe("resolveDeaths – fair tiebreaker", () => {
  it("selects higher ATK dead unit first", () => {
    const highAtk = makeBattleUnit({ id: "token", uid: "high", atk: 10, hp: 0 });
    const lowAtk = makeBattleUnit({ id: "token", uid: "low", atk: 2, hp: 0 });
    const ctx = makeContext([lowAtk, highAtk], []);
    resolveDeaths(ctx);
    // highAtk (ATK=10) should be resolved first; both dead so both removed
    // but the death frame order should show high first
    const deathFrames = ctx.frames.filter((f) => f.log.type === "death");
    expect(logText(deathFrames[0]!)).toContain(highAtk.name);
  });

  it("selects uniformly among tied dead units", () => {
    // counts[0]=A, counts[1]=B, counts[2]=C
    const counts = [0, 0, 0];
    for (let seed = 1; seed <= 300; seed++) {
      const a = makeBattleUnit({ id: "token", uid: `a-${seed}`, name: "A", atk: 5, hp: 0 });
      const b = makeBattleUnit({ id: "token", uid: `b-${seed}`, name: "B", atk: 5, hp: 0 });
      const c = makeBattleUnit({ id: "token", uid: `c-${seed}`, name: "C", atk: 5, hp: 0 });
      const rng = createSeededRng(seed);
      const ctx = makeContext([a, b, c], [], null, rng);
      resolveDeaths(ctx);
      const firstDeath = ctx.frames.find((f) => f.log.type === "death");
      const txt = firstDeath ? logText(firstDeath) : "";
      if (txt.includes("A")) counts[0] = counts[0]! + 1;
      else if (txt.includes("B")) counts[1] = counts[1]! + 1;
      else if (txt.includes("C")) counts[2] = counts[2]! + 1;
    }
    // Each should be picked ~100 times; allow generous variance (>50)
    expect(counts[0]).toBeGreaterThan(50);
    expect(counts[1]).toBeGreaterThan(50);
    expect(counts[2]).toBeGreaterThan(50);
  });
});

describe("resolveDeaths – hanged_man", () => {
  it("distributes atk and preDeathHp to front allies on death", () => {
    const hanged = makeBattleUnit({
      id: "hanged_man",
      name: "首吊り",
      atk: 10,
      hp: 0,
      preDeathHp: 8,
    });
    const ally1 = makeBattleUnit({ atk: 2, hp: 5 });
    const ally2 = makeBattleUnit({ atk: 3, hp: 4 });
    const ally3 = makeBattleUnit({ atk: 1, hp: 3 });
    const ctx = makeContext([hanged, ally1, ally2, ally3], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const targets = atLevel(HANGED_MAN.targets, 1);
    const atkShare = Math.floor(10 / targets);
    const hpShare = Math.floor(8 / targets);
    expect(ally1.atk).toBe(2 + atkShare);
    expect(ally1.hp).toBe(5 + hpShare);
    expect(ally2.atk).toBe(3 + atkShare);
    expect(ally2.hp).toBe(4 + hpShare);
    expect(ally3.atk).toBe(1 + atkShare);
    expect(ally3.hp).toBe(3 + hpShare);
  });
});

describe("resolveDeaths – seraph", () => {
  it("buffs all allies on death", () => {
    const seraph = makeBattleUnit({ id: "seraph", name: "熾天使", atk: 4, hp: 0, isChurch: true });
    const ally1 = makeBattleUnit({ atk: 2, hp: 5 });
    const ally2 = makeBattleUnit({ atk: 3, hp: 4 });
    const ctx = makeContext([seraph, ally1, ally2], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const b = atLevel(SERAPH.deathBuff, 1);
    expect(ally1.atk).toBe(2 + b.atk);
    expect(ally1.hp).toBe(5 + b.hp);
    expect(ally2.atk).toBe(3 + b.atk);
    expect(ally2.hp).toBe(4 + b.hp);
  });
});

describe("resolveDeaths – beast death board size guard", () => {
  it("spawns after beast removal frees a slot", () => {
    const beast = makeBattleUnit({ id: "beast", name: "獣", atk: 4, hp: 0 });
    const filler = Array.from({ length: MAX_BOARD_SIZE - 1 }, () => makeBattleUnit({ hp: 5 }));
    const board = [beast, ...filler];
    const ctx = makeContext(board, [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    // beast spliced out (4 remain) → death handler spawns a tier-3 unit (back to 5)
    expect(ctx.pBoard.length).toBe(MAX_BOARD_SIZE);
    expect(ctx.pBoard.every((u) => u.id !== "beast")).toBe(true);
  });
});
