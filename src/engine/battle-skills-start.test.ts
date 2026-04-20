import { runStartSkills } from "./battle-skills";
import { resolveDeaths } from "./battle-deaths";
import { makeBattleUnit, makeContext, INERT_UNIT_ID } from "./test-helpers";
import { atLevel, EVANGELIST } from "../shared/skill-params";

describe("devouring_graft – start skill", () => {
  it("absorbs predecessor without stat gain", () => {
    const pred = makeBattleUnit({ id: "rat", name: "疫病ネズミ", atk: 5, hp: 3 });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const board = [pred, graft];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    expect(graft.atk).toBe(3);
    expect(graft.hp).toBe(6);
    expect(board).toHaveLength(1);
    expect(board[0]).toBe(graft);
    expect(ctx.absorbedUnits.has(graft.uid)).toBe(true);
  });

  it("absorbs token without stat gain", () => {
    const token = makeBattleUnit({ id: INERT_UNIT_ID, name: "肉塊", atk: 2, hp: 2 });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const board = [token, graft];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    expect(graft.atk).toBe(3);
    expect(graft.hp).toBe(6);
    expect(board).toHaveLength(1);
    expect(ctx.absorbedUnits.has(graft.uid)).toBe(true);
  });

  it("does nothing at position 0", () => {
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const board = [graft];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    expect(graft.atk).toBe(3);
    expect(board).toHaveLength(1);
    expect(ctx.absorbedUnits.size).toBe(0);
  });
});

describe("mimicking_flesh – skill copy", () => {
  it("copies predecessor id and fires start skill", () => {
    const bat = makeBattleUnit({ id: "bat", name: "死蝙蝠", atk: 2, hp: 1 });
    const mimic = makeBattleUnit({ id: "mimicking_flesh", name: "模倣する粘肉", atk: 4, hp: 3 });
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 10 });
    const board = [bat, mimic];
    const ctx = makeContext(board, [enemy]);
    runStartSkills(board, [enemy], true, ctx);
    expect(mimic.id).toBe("bat");
    expect(mimic.name).toBe("死蝙蝠");
    expect(enemy.hp).toBeLessThan(10);
  });

  it("does nothing without predecessor", () => {
    const mimic = makeBattleUnit({ id: "mimicking_flesh", name: "模倣する粘肉", atk: 4, hp: 3 });
    const board = [mimic];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    expect(mimic.id).toBe("mimicking_flesh");
  });
});

describe("mimicking_flesh + devouring_graft – interaction edge cases", () => {
  it("chain absorption: mimic copies graft after graft absorbs predecessor", () => {
    const rat = makeBattleUnit({ id: "rat", name: "疫病ネズミ", atk: 2, hp: 1 });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const mimic = makeBattleUnit({ id: "mimicking_flesh", name: "模倣する粘肉", atk: 4, hp: 3 });
    const board = [rat, graft, mimic];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    // graft absorbs rat (no stat gain), then mimic copies graft and absorbs graft (no stat gain)
    expect(board).toHaveLength(1);
    expect(board[0]).toBe(mimic);
    expect(mimic.id).toBe("devouring_graft");
    expect(mimic.atk).toBe(4);
    expect(mimic.hp).toBe(3);
    expect(ctx.absorbedUnits.has(mimic.uid)).toBe(true);
    const absorbed = ctx.absorbedUnits.get(mimic.uid)!;
    expect(absorbed.id).toBe("devouring_graft");
  });

  it("graft absorbs mimic; re-spawns mimicking_flesh on death", () => {
    const mimic = makeBattleUnit({ id: "mimicking_flesh", name: "模倣する粘肉", atk: 4, hp: 3 });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const board = [mimic, graft];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    // mimic at pos 0 does nothing; graft absorbs mimic (no stat gain)
    expect(board).toHaveLength(1);
    expect(board[0]).toBe(graft);
    expect(graft.atk).toBe(3);
    expect(graft.hp).toBe(6);
    const absorbed = ctx.absorbedUnits.get(graft.uid)!;
    expect(absorbed.id).toBe("mimicking_flesh");
    // Kill graft → re-spawns mimicking_flesh with base stats
    graft.hp = 0;
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.name).toBe("模倣する粘肉");
    expect(ctx.pBoard[0]!.atk).toBe(4); // baseAtk of mimicking_flesh
    expect(ctx.pBoard[0]!.hp).toBe(2); // baseHp of mimicking_flesh
  });

  it("multiple grafts chain: B absorbs A after A absorbs rat", () => {
    const rat = makeBattleUnit({ id: "rat", name: "疫病ネズミ", atk: 2, hp: 1 });
    const graftA = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const graftB = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 5, hp: 4 });
    const board = [rat, graftA, graftB];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    // A absorbs rat (no stat gain): A stays 3/6
    // B absorbs A (no stat gain): B stays 5/4
    expect(board).toHaveLength(1);
    expect(board[0]).toBe(graftB);
    expect(graftB.atk).toBe(5);
    expect(graftB.hp).toBe(4);
    // B stored A's stats at absorption time (A was 3/6, no stat gain)
    const absorbedByB = ctx.absorbedUnits.get(graftB.uid)!;
    expect(absorbedByB.id).toBe("devouring_graft");
    expect(absorbedByB.atk).toBe(3);
    // Kill B → re-spawns devouring_graft with base stats (baseAtk=3, baseHp=7)
    graftB.hp = 0;
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.name).toBe("貪る接合体");
    expect(ctx.pBoard[0]!.atk).toBe(3);
    expect(ctx.pBoard[0]!.hp).toBe(7);
  });
});

describe("applyEvangelistSkill – start of battle", () => {
  it("reduces highest-HP enemy HP by 33% (Lv1)", () => {
    const ev = makeBattleUnit({ id: "evangelist", name: "伝道師", atk: 1, hp: 8 });
    const strong = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 10 });
    const weak = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 4 });
    const ctx = makeContext([ev], [strong, weak]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    const percent = atLevel(EVANGELIST.reductionPercent, 1);
    const dmg = Math.max(1, Math.floor((10 * percent) / 100));
    expect(strong.hp).toBe(10 - dmg);
    expect(weak.hp).toBe(4);
  });

  it("reduces by 99% at Lv3", () => {
    const ev = makeBattleUnit({ id: "evangelist", name: "伝道師", atk: 1, hp: 8, level: 3 });
    const target = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 10 });
    const ctx = makeContext([ev], [target]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    const percent = atLevel(EVANGELIST.reductionPercent, 3);
    const dmg = Math.max(1, Math.floor((10 * percent) / 100));
    expect(target.hp).toBe(10 - dmg);
  });

  it("targets highest-HP enemy when multiple present", () => {
    const ev = makeBattleUnit({ id: "evangelist", name: "伝道師", atk: 1, hp: 8 });
    const low = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 3 });
    const high = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 20 });
    const ctx = makeContext([ev], [low, high]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    const percent = atLevel(EVANGELIST.reductionPercent, 1);
    const dmg = Math.max(1, Math.floor((20 * percent) / 100));
    expect(high.hp).toBe(20 - dmg);
    expect(low.hp).toBe(3);
  });

  it("skips already-dead targets (no negative damage / no heal)", () => {
    const ev = makeBattleUnit({ id: "evangelist", name: "伝道師", atk: 1, hp: 8 });
    const dead = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 0 });
    const alive = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 5 });
    const ctx = makeContext([ev], [dead, alive]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(dead.hp).toBe(0);
    const percent = atLevel(EVANGELIST.reductionPercent, 1);
    const dmg = Math.max(1, Math.floor((5 * percent) / 100));
    expect(alive.hp).toBe(5 - dmg);
  });

  it("no-op when all enemies are dead", () => {
    const ev = makeBattleUnit({ id: "evangelist", name: "伝道師", atk: 1, hp: 8 });
    const corpse = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 0 });
    const ctx = makeContext([ev], [corpse]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(corpse.hp).toBe(0);
  });

  it("deals at least 1 damage at low HP even with small percent", () => {
    const ev = makeBattleUnit({ id: "evangelist", name: "伝道師", atk: 1, hp: 8 });
    const target = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 1 });
    const ctx = makeContext([ev], [target]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(target.hp).toBe(0);
  });
});
