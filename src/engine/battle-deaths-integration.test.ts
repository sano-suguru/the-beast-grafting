import { resolveDeaths } from "./battle-deaths";
import { INERT_UNIT_ID, makeBattleUnit, makeContext } from "./test-helpers";
import { atLevel, SERAPH } from "../shared/skill-params";
import type { BattleUnit } from "./battle-context";
import type { UnitId } from "../shared/types";

describe("resolveDeaths – puppeteer doubles death skill", () => {
  it("doubles seraph death buff when puppeteer is in front", () => {
    const puppeteer = makeBattleUnit({ id: "puppeteer", name: "操り糸", atk: 4, hp: 6 });
    const seraph = makeBattleUnit({
      id: "seraph",
      name: "熾天使",
      atk: 4,
      hp: 0,
      isChurch: true,
    });
    const ally1 = makeBattleUnit({ atk: 2, hp: 5 });
    const ally2 = makeBattleUnit({ atk: 1, hp: 3 });
    const ctx = makeContext([puppeteer, seraph, ally1, ally2], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const b = atLevel(SERAPH.deathBuff, 1);
    expect(puppeteer.atk).toBe(4 + b.atk * 2);
    expect(ally1.atk).toBe(2 + b.atk * 2);
    expect(ally1.hp).toBe(5 + b.hp * 2);
  });

  it("does not double when puppeteer is not at deathIdx-1", () => {
    const seraph = makeBattleUnit({
      id: "seraph",
      name: "熾天使",
      atk: 4,
      hp: 0,
      isChurch: true,
    });
    const puppeteer = makeBattleUnit({ id: "puppeteer", name: "操り糸", atk: 4, hp: 6 });
    const ally1 = makeBattleUnit({ atk: 2, hp: 5 });
    const ally2 = makeBattleUnit({ atk: 1, hp: 3 });
    const ctx = makeContext([seraph, puppeteer, ally1, ally2], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const b = atLevel(SERAPH.deathBuff, 1);
    expect(puppeteer.atk).toBe(4 + b.atk);
    expect(ally1.atk).toBe(2 + b.atk);
    expect(ally2.atk).toBe(1 + b.atk);
  });
});

describe("puppeteer does NOT double ally reactions (getMult only checks brains)", () => {
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
      equip: "maggot",
    });
    const ctx = makeContext([puppeteer, hound], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const heads = ctx.pBoard.filter((u) => u.name === "噛み付く頭部");
    const maggots = ctx.pBoard.filter((u) => u.name === "巨大蛆虫");
    expect(heads).toHaveLength(2);
    expect(maggots).toHaveLength(1);
  });
});

describe("brains does not double equip death effect (SAP準拠)", () => {
  it("brains + hound with maggot_nest: 2 heads (skill×2) + 1 maggot (equip×1)", () => {
    const hound = makeBattleUnit({
      id: "hound",
      name: "猟犬",
      atk: 3,
      hp: 0,
      equip: "maggot",
    });
    const brains = makeBattleUnit({ id: "brains", name: "双子脳", atk: 6, hp: 4 });
    const ctx = makeContext([hound, brains], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const heads = ctx.pBoard.filter((u) => u.name === "噛み付く頭部");
    const maggots = ctx.pBoard.filter((u) => u.name === "巨大蛆虫");
    expect(heads).toHaveLength(2);
    expect(maggots).toHaveLength(1);
  });
});

describe("resolveDeaths – token deaths do not increment avenge", () => {
  it("token death does not increment grinning_skull avenge counter", () => {
    const skull = makeBattleUnit({ id: "grinning_skull", atk: 0, hp: 6, skillUses: 1 });
    const token: BattleUnit = {
      ...makeBattleUnit({ id: "token" as UnitId, atk: 3, hp: 0, name: "肉塊" }),
      id: "token",
    };
    const pBoard = [token, skull];
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 99 });
    const ctx = makeContext(pBoard, [enemy]);
    resolveDeaths(ctx);
    expect(skull.avengeDeathCount).toBe(0);
  });

  it("real unit death increments avenge counter (regression)", () => {
    const skull = makeBattleUnit({ id: "grinning_skull", atk: 0, hp: 6, skillUses: 1 });
    const fodder = makeBattleUnit({ id: "beggar" as UnitId, atk: 1, hp: 0 });
    const pBoard = [fodder, skull];
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 99 });
    const ctx = makeContext(pBoard, [enemy]);
    resolveDeaths(ctx);
    expect(skull.avengeDeathCount).toBe(1);
  });

  it("mixed real+token deaths only count real for avenge", () => {
    const skull = makeBattleUnit({ id: "grinning_skull", atk: 0, hp: 6, skillUses: 1 });
    const real1 = makeBattleUnit({ id: "beggar" as UnitId, atk: 2, hp: 0 });
    const real2 = makeBattleUnit({ id: "beggar" as UnitId, atk: 1, hp: 0 });
    const token: BattleUnit = {
      ...makeBattleUnit({ id: "token" as UnitId, atk: 3, hp: 0, name: "肉塊" }),
      id: "token",
    };
    const pBoard = [real1, token, real2, skull];
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 99 });
    const ctx = makeContext(pBoard, [enemy]);
    resolveDeaths(ctx);
    // 2 real deaths, threshold=3 not reached → counter = 2
    expect(skull.avengeDeathCount).toBe(2);
    // threshold not reached → no buff applied
    expect(skull.atk).toBe(0);
  });
});
