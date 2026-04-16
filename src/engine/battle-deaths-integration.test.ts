import { resolveDeaths } from "./battle-deaths";
import { INERT_UNIT_ID, makeBattleUnit, makeContext } from "./test-helpers";
import { atLevel, HANGED_MAN, CROW } from "../shared/skill-params";
import type { BattleUnit } from "./battle-context";
import type { UnitId } from "../shared/types";

describe("resolveDeaths – puppeteer doubles death skill", () => {
  it("doubles hanged_man death effect when puppeteer is in front", () => {
    const puppeteer = makeBattleUnit({ id: "puppeteer", name: "操り糸", atk: 4, hp: 6 });
    const hanged = makeBattleUnit({
      id: "hanged_man",
      name: "首吊り",
      atk: 10,
      hp: 0,
      preDeathHp: 8,
    });
    const ally1 = makeBattleUnit({ atk: 2, hp: 5 });
    const ally2 = makeBattleUnit({ atk: 1, hp: 3 });
    const ctx = makeContext([puppeteer, hanged, ally1, ally2], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const targets = atLevel(HANGED_MAN.targets, 1);
    const atkShare = Math.floor(10 / targets);
    const hpShare = Math.floor(8 / targets);
    // 2回発動 → 2倍バフ（前方targets体=3体: puppeteer, ally1, ally2）
    expect(puppeteer.atk).toBe(4 + atkShare * 2);
    expect(ally1.atk).toBe(2 + atkShare * 2);
    expect(ally1.hp).toBe(5 + hpShare * 2);
  });

  it("does not double when puppeteer is not at deathIdx-1", () => {
    // hanged is at index 0 → board[-1] is undefined → deathMult = 1
    const hanged = makeBattleUnit({
      id: "hanged_man",
      name: "首吊り",
      atk: 10,
      hp: 0,
      preDeathHp: 8,
    });
    const puppeteer = makeBattleUnit({ id: "puppeteer", name: "操り糸", atk: 4, hp: 6 });
    const ally1 = makeBattleUnit({ atk: 2, hp: 5 });
    const ally2 = makeBattleUnit({ atk: 1, hp: 3 });
    const ctx = makeContext([hanged, puppeteer, ally1, ally2], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const targets = atLevel(HANGED_MAN.targets, 1);
    const atkShare = Math.floor(10 / targets);
    // Only 1x, distributes to front targets体: puppeteer, ally1, ally2
    expect(puppeteer.atk).toBe(4 + atkShare);
    expect(ally1.atk).toBe(2 + atkShare);
    expect(ally2.atk).toBe(1 + atkShare);
  });
});

describe("puppeteer does NOT double ally reactions (getMult only checks brains)", () => {
  it("puppeteer in front of crow does not double crow death buff", () => {
    const dying = makeBattleUnit({ id: "beggar", hp: 0 });
    const puppeteer = makeBattleUnit({ id: "puppeteer", name: "操り糸", atk: 4, hp: 6 });
    const crow = makeBattleUnit({ id: "crow", name: "鴉", atk: 2, hp: 1, skillUses: 2 });
    const ctx = makeContext([dying, puppeteer, crow], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const b = atLevel(CROW.buff, 1);
    // getMult checks brains, not puppeteer → crow triggers once
    expect(crow.atk).toBe(2 + b.atk);
    expect(crow.hp).toBe(1 + b.hp);
  });

  it("brains behind crow DOES double crow death buff", () => {
    const dying = makeBattleUnit({ id: "beggar", hp: 0 });
    const crow = makeBattleUnit({ id: "crow", name: "鴉", atk: 2, hp: 1, skillUses: 4 });
    const brains = makeBattleUnit({ id: "brains", name: "双子脳", atk: 6, hp: 4 });
    const ctx = makeContext([dying, crow, brains], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const b = atLevel(CROW.buff, 1);
    // getMult returns 2 (brains behind crow) → crow triggers twice
    expect(crow.atk).toBe(2 + b.atk * 2);
    expect(crow.hp).toBe(1 + b.hp * 2);
  });

  it("puppeteer in front of cathedral does not double cathedral spawn", () => {
    const dying = makeBattleUnit({ id: "beggar", hp: 0 });
    const puppeteer = makeBattleUnit({ id: "puppeteer", name: "操り糸", atk: 4, hp: 6 });
    const cathedral = makeBattleUnit({
      id: "cathedral",
      name: "礼拝堂",
      atk: 1,
      hp: 8,
      skillUses: 2,
    });
    const ctx = makeContext([dying, puppeteer, cathedral], [makeBattleUnit({ hp: 20 })]);
    resolveDeaths(ctx);
    // puppeteer does not affect getMult → cathedral spawns once
    expect(ctx.pBoard.filter((u) => u.name === "信徒")).toHaveLength(1);
    expect(cathedral.skillUses).toBe(1);
  });
});

describe("successor recalculation on multi-trigger", () => {
  it("hound with brains spawns 2 tokens at correct position", () => {
    const hound = makeBattleUnit({ id: "hound", name: "猟犬", atk: 3, hp: 0 });
    const brains = makeBattleUnit({ id: "brains", name: "双子脳", atk: 6, hp: 4 });
    const ally = makeBattleUnit({ atk: 2, hp: 5 });
    const ctx = makeContext([hound, brains, ally], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const tokens = ctx.pBoard.filter((u) => u.name === "噛み付く頭部");
    expect(tokens).toHaveLength(2);
  });
});

describe("puppeteer doubles unit skill only, not equip death", () => {
  it("puppeteer + hound with maggot_nest: 2 heads (skill×2) + 1 maggot (equip×1)", () => {
    const puppeteer = makeBattleUnit({ id: "puppeteer", name: "操り糸", atk: 4, hp: 6 });
    const hound = makeBattleUnit({
      id: "hound",
      name: "猟犬",
      atk: 3,
      hp: 0,
      equip: "maggot_nest",
    });
    const ctx = makeContext([puppeteer, hound], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const heads = ctx.pBoard.filter((u) => u.name === "噛み付く頭部");
    const maggots = ctx.pBoard.filter((u) => u.name === "巨大蛆虫");
    expect(heads).toHaveLength(2);
    expect(maggots).toHaveLength(1);
  });
});

describe("resolveDeaths – token deaths do not increment avenge", () => {
  it("token death does not increment charnel_pit avenge counter", () => {
    const pit = makeBattleUnit({ id: "charnel_pit", atk: 0, hp: 6 });
    const token: BattleUnit = {
      ...makeBattleUnit({ id: "token" as UnitId, atk: 3, hp: 0, name: "肉塊" }),
      id: "token",
    };
    const pBoard = [token, pit];
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 99 });
    const ctx = makeContext(pBoard, [enemy]);
    resolveDeaths(ctx);
    expect(pit.avengeDeathCount).toBe(0);
  });

  it("real unit death increments avenge counter (regression)", () => {
    const pit = makeBattleUnit({ id: "charnel_pit", atk: 0, hp: 6 });
    // beggar has no death handler → pure avenge test
    const fodder = makeBattleUnit({ id: "beggar" as UnitId, atk: 1, hp: 0 });
    const pBoard = [fodder, pit];
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 99 });
    const ctx = makeContext(pBoard, [enemy]);
    resolveDeaths(ctx);
    expect(pit.avengeDeathCount).toBe(1);
  });

  it("mixed real+token deaths only count real for avenge", () => {
    const pit = makeBattleUnit({ id: "charnel_pit", atk: 0, hp: 6, skillUses: 1 });
    const real1 = makeBattleUnit({ id: "beggar" as UnitId, atk: 2, hp: 0 });
    const real2 = makeBattleUnit({ id: "beggar" as UnitId, atk: 1, hp: 0 });
    const token: BattleUnit = {
      ...makeBattleUnit({ id: "token" as UnitId, atk: 3, hp: 0, name: "肉塊" }),
      id: "token",
    };
    const pBoard = [real1, token, real2, pit];
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 99 });
    const ctx = makeContext(pBoard, [enemy]);
    resolveDeaths(ctx);
    // 2 real deaths → charnel_pit threshold(2) reached → triggered once, counter reset to 0
    expect(pit.avengeDeathCount).toBe(0);
    // charnel_pit spawned a token (肉塊)
    expect(ctx.pBoard.some((u) => u.name === "肉塊")).toBe(true);
  });
});

describe("resolveDeaths – cross-board cascade", () => {
  it("evangelist skips already-infected enemies", () => {
    const dead1 = makeBattleUnit({ id: "beggar", hp: 0, atk: 5 });
    const dead2 = makeBattleUnit({ id: "beggar", hp: 0, atk: 2 });
    const evangelist = makeBattleUnit({
      id: "evangelist",
      name: "伝道師",
      atk: 1,
      hp: 10,
      skillUses: 2,
    });
    const enemy1 = makeBattleUnit({ hp: 10 });
    const enemy2 = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([dead1, dead2, evangelist], [enemy1, enemy2], null, { next: () => 0 });
    resolveDeaths(ctx);
    expect(enemy1.equip).toBe("infection");
    expect(enemy2.equip).toBe("infection");
  });
});
