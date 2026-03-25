import { resolveDeaths } from "./battle-deaths";
import { createSeededRng } from "./rng";
import { makeBattleUnit, makeContext } from "./test-helpers";

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
  it("rat death buffs a random ally +1/+1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const rat = makeBattleUnit({ id: "rat", hp: 0 });
    const ally = makeBattleUnit({ atk: 3, hp: 5 });
    const ctx = makeContext([rat, ally], []);
    resolveDeaths(ctx);
    expect(ally.atk).toBe(4);
    expect(ally.hp).toBe(6);
    vi.restoreAllMocks();
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

  it("beast death spawns 2/2 token", () => {
    const beast = makeBattleUnit({ id: "beast", name: "腐肉獣", hp: 0 });
    const ctx = makeContext([beast], []);
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.atk).toBe(2);
    expect(ctx.pBoard[0]!.hp).toBe(2);
  });

  it("church_beast death spawns 2/2 token with isChurch", () => {
    const cb = makeBattleUnit({ id: "church_beast", name: "偽天使", hp: 0, isChurch: true });
    const ctx = makeContext([], [cb]);
    resolveDeaths(ctx);
    expect(ctx.eBoard).toHaveLength(1);
    expect(ctx.eBoard[0]!.isChurch).toBe(true);
    expect(ctx.eBoard[0]!.atk).toBe(2);
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

  it("priest death heals all allies +1 HP", () => {
    const priest = makeBattleUnit({ id: "priest", name: "司祭", hp: 0 });
    const ally1 = makeBattleUnit({ hp: 3 });
    const ally2 = makeBattleUnit({ hp: 2 });
    const ctx = makeContext([priest, ally1, ally2], []);
    resolveDeaths(ctx);
    expect(ally1.hp).toBe(4);
    expect(ally2.hp).toBe(3);
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
    const unit = makeBattleUnit({ equip: "maggot_nest", hp: 0 });
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

  it("altar buffs spawned tokens +3/+1", () => {
    const hound = makeBattleUnit({ id: "hound", name: "猟犬", hp: 0 });
    const altar = makeBattleUnit({ id: "altar", name: "祭壇", atk: 3, hp: 4 });
    const ctx = makeContext([hound, altar], []);
    resolveDeaths(ctx);
    const token = ctx.pBoard.find((u) => u.id === "token");
    expect(token).toBeDefined();
    expect(token!.atk).toBe(4); // 1 base + 3 altar
    expect(token!.hp).toBe(2); // 1 base + 1 altar
  });

  it("altar log shows +3/+1 and final stats without brains", () => {
    const hound = makeBattleUnit({ id: "hound", name: "猟犬", hp: 0 });
    const altar = makeBattleUnit({ id: "altar", name: "祭壇", atk: 3, hp: 4 });
    const ctx = makeContext([hound, altar], []);
    resolveDeaths(ctx);
    const altarLog = ctx.frames.find((f) => f.log.text.includes("邪神の祝福"));
    expect(altarLog).toBeDefined();
    expect(altarLog!.log.text).toContain("+3/+1");
    expect(altarLog!.log.text).toContain("→ (4/2)");
  });

  it("altar buff doubles with brains behind it", () => {
    const hound = makeBattleUnit({ id: "hound", name: "猟犬", hp: 0 });
    const altar = makeBattleUnit({ id: "altar", name: "祭壇", atk: 3, hp: 4 });
    const brains = makeBattleUnit({ id: "brains", name: "双子脳", atk: 6, hp: 4 });
    const ctx = makeContext([hound, altar, brains], []);
    resolveDeaths(ctx);
    const token = ctx.pBoard.find((u) => u.id === "token");
    expect(token).toBeDefined();
    expect(token!.atk).toBe(7); // 1 base + 3*2 altar
    expect(token!.hp).toBe(3); // 1 base + 1*2 altar
  });

  it("altar log shows doubled buff and final stats with brains", () => {
    const hound = makeBattleUnit({ id: "hound", name: "猟犬", hp: 0 });
    const altar = makeBattleUnit({ id: "altar", name: "祭壇", atk: 3, hp: 4 });
    const brains = makeBattleUnit({ id: "brains", name: "双子脳", atk: 6, hp: 4 });
    const ctx = makeContext([hound, altar, brains], []);
    resolveDeaths(ctx);
    const altarLog = ctx.frames.find((f) => f.log.text.includes("邪神の祝福"));
    expect(altarLog).toBeDefined();
    expect(altarLog!.log.text).toContain("+6/+2");
    expect(altarLog!.log.text).toContain("→ (7/3)");
  });
});

describe("resolveDeaths – beelzebub", () => {
  it("spawns 4/4 fly on ally death", () => {
    const dying = makeBattleUnit({ hp: 0 });
    const beelzebub = makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", atk: 4, hp: 4 });
    const ctx = makeContext([dying, beelzebub], []);
    resolveDeaths(ctx);
    const fly = ctx.pBoard.find((u) => u.name === "腐肉の蠅");
    expect(fly).toBeDefined();
    expect(fly!.atk).toBe(4);
    expect(fly!.hp).toBe(4);
  });

  it("fly spawn is capped at 3", () => {
    const units = [
      makeBattleUnit({ hp: 0 }),
      makeBattleUnit({ hp: 0 }),
      makeBattleUnit({ hp: 0 }),
      makeBattleUnit({ hp: 0 }),
      makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", atk: 4, hp: 4 }),
    ];
    const ctx = makeContext(units, []);
    resolveDeaths(ctx);
    const flies = ctx.pBoard.filter((u) => u.name === "腐肉の蠅");
    expect(flies.length).toBeLessThanOrEqual(3);
  });

  it("two beelzebubs share fly counter (capped at 3 total)", () => {
    const units = [
      makeBattleUnit({ hp: 0 }),
      makeBattleUnit({ hp: 0 }),
      makeBattleUnit({ hp: 0 }),
      makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ1", atk: 4, hp: 4 }),
      makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ2", atk: 4, hp: 4 }),
    ];
    const ctx = makeContext(units, []);
    resolveDeaths(ctx);
    expect(ctx.pFlyCount).toBeLessThanOrEqual(3);
    const flies = ctx.pBoard.filter((u) => u.name === "腐肉の蠅");
    expect(flies.length).toBeLessThanOrEqual(3);
  });

  it("brains behind beelzebub spawns 2 flies per faint (SAP Tiger+Fly)", () => {
    const dying = makeBattleUnit({ hp: 0 });
    const beelzebub = makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", atk: 4, hp: 4 });
    const brains = makeBattleUnit({ id: "brains", name: "双子脳", atk: 6, hp: 4 });
    const ctx = makeContext([dying, beelzebub, brains], []);
    resolveDeaths(ctx);
    const flies = ctx.pBoard.filter((u) => u.name === "腐肉の蠅");
    expect(flies.length).toBe(2);
    expect(ctx.pFlyCount).toBe(2);
  });

  it("fly counter persists across multiple death resolutions", () => {
    const d1 = makeBattleUnit({ id: "eye", hp: 0, atk: 5 });
    const d2 = makeBattleUnit({ id: "eye", hp: 0, atk: 3 });
    const d3 = makeBattleUnit({ id: "eye", hp: 0, atk: 1 });
    const beelzebub = makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", atk: 4, hp: 4 });
    const ctx = makeContext([d1, d2, d3, beelzebub], []);
    resolveDeaths(ctx);
    expect(ctx.pFlyCount).toBe(3);
  });

  it("token (zombie fly) death does not trigger beelzebub spawns (SAP準拠)", () => {
    const token = makeBattleUnit({ id: "token", name: "腐肉の蠅", hp: 0 });
    const beelzebub = makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", atk: 4, hp: 4 });
    const ctx = makeContext([token, beelzebub], []);
    resolveDeaths(ctx);
    expect(ctx.pFlyCount).toBe(0);
    expect(ctx.pBoard.filter((u) => u.name === "腐肉の蠅")).toHaveLength(0);
  });

  it("player and enemy fly counters are independent", () => {
    const pDead = makeBattleUnit({ hp: 0 });
    const pBeelzebub = makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", atk: 4, hp: 4 });
    const eDead = makeBattleUnit({ hp: 0 });
    const eBeelzebub = makeBattleUnit({ id: "beelzebub", name: "敵ベルゼブブ", atk: 4, hp: 4 });
    const ctx = makeContext([pDead, pBeelzebub], [eDead, eBeelzebub]);
    resolveDeaths(ctx);
    expect(ctx.pFlyCount).toBeGreaterThanOrEqual(1);
    expect(ctx.eFlyCount).toBeGreaterThanOrEqual(1);
  });

  it("beelzebub does not spawn fly when it is the one dying", () => {
    const beelzebub = makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", atk: 4, hp: 0 });
    const ctx = makeContext([beelzebub], []);
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(0);
    expect(ctx.pFlyCount).toBe(0);
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
    expect(deathFrames[0]!.log.text).toContain(highAtk.name);
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
      if (firstDeath?.log.text.includes("A")) counts[0] = counts[0]! + 1;
      else if (firstDeath?.log.text.includes("B")) counts[1] = counts[1]! + 1;
      else if (firstDeath?.log.text.includes("C")) counts[2] = counts[2]! + 1;
    }
    // Each should be picked ~100 times; allow generous variance (>50)
    expect(counts[0]).toBeGreaterThan(50);
    expect(counts[1]).toBeGreaterThan(50);
    expect(counts[2]).toBeGreaterThan(50);
  });
});
