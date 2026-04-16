import { runStartSkills } from "./battle-skills";
import { resolveDeaths } from "./battle-deaths";
import { makeBattleUnit, makeContext, INERT_UNIT_ID } from "./test-helpers";
import { atLevel, CHOLERA } from "../shared/skill-params";

describe("devouring_graft – start skill", () => {
  it("absorbs predecessor and gains stats", () => {
    const pred = makeBattleUnit({ id: "rat", name: "疫病ネズミ", atk: 5, hp: 3 });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const board = [pred, graft];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    expect(graft.atk).toBe(3 + Math.floor(5 * 0.7));
    expect(graft.hp).toBe(6 + Math.floor(3 * 0.7));
    expect(board).toHaveLength(1);
    expect(board[0]).toBe(graft);
    expect(ctx.absorbedUnits.has(graft.uid)).toBe(true);
  });

  it("absorbs token stats and stores absorbed data", () => {
    const token = makeBattleUnit({ id: INERT_UNIT_ID, name: "肉塊", atk: 2, hp: 2 });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const board = [token, graft];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    expect(graft.atk).toBe(3 + Math.floor(2 * 0.7));
    expect(graft.hp).toBe(6 + Math.floor(2 * 0.7));
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
    // graft absorbs rat (70%), then mimic copies graft and absorbs graft (70%)
    // graft after rat: 3+floor(2*0.7)=4, 6+floor(1*0.7)=6
    // mimic after graft: 4+floor(4*0.7)=6, 3+floor(6*0.7)=7
    expect(board).toHaveLength(1);
    expect(board[0]).toBe(mimic);
    expect(mimic.id).toBe("devouring_graft");
    expect(mimic.atk).toBe(6);
    expect(mimic.hp).toBe(7);
    expect(ctx.absorbedUnits.has(mimic.uid)).toBe(true);
    const absorbed = ctx.absorbedUnits.get(mimic.uid)!;
    expect(absorbed.id).toBe("devouring_graft");
  });

  it("mimic copies cholera and gets initOverride applied", () => {
    const cholera = makeBattleUnit({ id: "cholera", name: "コレラ", atk: 3, hp: 3 });
    const mimic = makeBattleUnit({ id: "mimicking_flesh", name: "模倣する粘肉", atk: 4, hp: 3 });
    const board = [cholera, mimic];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    expect(mimic.id).toBe("cholera");
    expect(mimic.skillUses).toBe(atLevel(CHOLERA.uses, mimic.level));
  });

  it("graft absorbs mimic; re-spawns mimicking_flesh on death", () => {
    const mimic = makeBattleUnit({ id: "mimicking_flesh", name: "模倣する粘肉", atk: 4, hp: 3 });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const board = [mimic, graft];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    // mimic at pos 0 does nothing; graft absorbs mimic (70%)
    expect(board).toHaveLength(1);
    expect(board[0]).toBe(graft);
    expect(graft.atk).toBe(3 + Math.floor(4 * 0.7));
    expect(graft.hp).toBe(6 + Math.floor(3 * 0.7));
    const absorbed = ctx.absorbedUnits.get(graft.uid)!;
    expect(absorbed.id).toBe("mimicking_flesh");
    // Kill graft → re-spawns mimicking_flesh with 30% decay
    graft.hp = 0;
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.name).toBe("模倣する粘肉");
    expect(ctx.pBoard[0]!.atk).toBe(Math.floor(4 * 0.3));
    expect(ctx.pBoard[0]!.hp).toBe(Math.max(1, Math.floor(3 * 0.3)));
  });

  it("multiple grafts chain: B absorbs A after A absorbs rat", () => {
    const rat = makeBattleUnit({ id: "rat", name: "疫病ネズミ", atk: 2, hp: 1 });
    const graftA = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const graftB = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 5, hp: 4 });
    const board = [rat, graftA, graftB];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    // A absorbs rat (70%): A = 3+floor(2*0.7)=4, 6+floor(1*0.7)=6
    // B absorbs A (70%): B = 5+floor(4*0.7)=7, 4+floor(6*0.7)=8
    expect(board).toHaveLength(1);
    expect(board[0]).toBe(graftB);
    expect(graftB.atk).toBe(7);
    expect(graftB.hp).toBe(8);
    // B stored A's stats at absorption time (A was 4/6)
    const absorbedByB = ctx.absorbedUnits.get(graftB.uid)!;
    expect(absorbedByB.id).toBe("devouring_graft");
    expect(absorbedByB.atk).toBe(4);
    // Kill B → A is re-spawned with 30% decayed stats: floor(4*0.3)=1, max(1,floor(6*0.3))=1
    graftB.hp = 0;
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.name).toBe("貪る接合体");
    expect(ctx.pBoard[0]!.atk).toBe(Math.floor(4 * 0.3));
    expect(ctx.pBoard[0]!.hp).toBe(Math.max(1, Math.floor(6 * 0.3)));
  });
});
