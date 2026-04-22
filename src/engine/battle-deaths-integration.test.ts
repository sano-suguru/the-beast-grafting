import { resolveDeaths } from "./battle-deaths";
import { INERT_UNIT_ID, makeBattleUnit, makeContext } from "./test-helpers";
import type { BattleUnit } from "./battle-context";
import type { UnitId } from "../shared/types";

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
  it("token death does not increment archangel avenge counter", () => {
    const arch = makeBattleUnit({ id: "archangel", atk: 0, hp: 6, skillUses: 1 });
    const token: BattleUnit = {
      ...makeBattleUnit({ id: "token" as UnitId, atk: 3, hp: 0, name: "肉塊" }),
      id: "token",
    };
    const pBoard = [token, arch];
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 99 });
    const ctx = makeContext(pBoard, [enemy]);
    resolveDeaths(ctx);
    expect(arch.avengeDeathCount).toBe(0);
  });

  it("real unit death increments avenge counter (regression)", () => {
    const arch = makeBattleUnit({ id: "archangel", atk: 0, hp: 6, skillUses: 1 });
    const fodder = makeBattleUnit({ id: "beggar" as UnitId, atk: 1, hp: 0 });
    const pBoard = [fodder, arch];
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 99 });
    const ctx = makeContext(pBoard, [enemy]);
    resolveDeaths(ctx);
    expect(arch.avengeDeathCount).toBe(1);
  });

  it("mixed real+token deaths only count real for avenge", () => {
    const arch = makeBattleUnit({ id: "archangel", atk: 0, hp: 6, skillUses: 0 });
    const real1 = makeBattleUnit({ id: "beggar" as UnitId, atk: 2, hp: 0 });
    const token: BattleUnit = {
      ...makeBattleUnit({ id: "token" as UnitId, atk: 3, hp: 0, name: "肉塊" }),
      id: "token",
    };
    const pBoard = [real1, token, arch];
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 99 });
    const ctx = makeContext(pBoard, [enemy]);
    resolveDeaths(ctx);
    // 1 real death; threshold=2 not reached → counter = 1 (token ignored)
    expect(arch.avengeDeathCount).toBe(1);
  });
});
