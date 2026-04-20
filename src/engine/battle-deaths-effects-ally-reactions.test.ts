import {
  handleInsatiableMawBuff,
  handleBoneTreeAllyDeath,
  handleCarrionSentinelAllyDeath,
} from "./battle-deaths-effects-ally-reactions";
import { makeBattleUnit, makeContext, INERT_UNIT_ID } from "./test-helpers";
import { atLevel, INSATIABLE_MAW, BONE_TREE } from "../shared/skill-params";

describe("handleInsatiableMawBuff", () => {
  it("buffs self on ally death", () => {
    const maw = makeBattleUnit({
      id: "insatiable_maw",
      name: "飽くなき咢",
      atk: 4,
      hp: 4,
      skillUses: 2,
    });
    const board = [maw];
    const ctx = makeContext(board, []);
    handleInsatiableMawBuff(board, true, ctx);
    const b = atLevel(INSATIABLE_MAW.buff, 1);
    expect(maw.atk).toBe(4 + b.atk);
    expect(maw.hp).toBe(4 + b.hp);
    expect(maw.skillUses).toBe(1);
    expect(ctx.frames).toHaveLength(1);
  });
});

describe("handleBoneTreeAllyDeath", () => {
  it("buffs all living allies in front on ally death", () => {
    const f0 = makeBattleUnit({ id: INERT_UNIT_ID, atk: 2, hp: 5 });
    const f1 = makeBattleUnit({ id: INERT_UNIT_ID, atk: 3, hp: 4 });
    const tree = makeBattleUnit({ id: "bone_tree", name: "骨樹", atk: 1, hp: 4, skillUses: 3 });
    const board = [f0, f1, tree];
    const ctx = makeContext(board, []);
    handleBoneTreeAllyDeath(board, true, ctx);
    const b = atLevel(BONE_TREE.buff, 1);
    expect(f0.atk).toBe(2 + b.atk);
    expect(f0.hp).toBe(5 + b.hp);
    expect(f1.atk).toBe(3 + b.atk);
    expect(f1.hp).toBe(4 + b.hp);
    expect(tree.skillUses).toBe(2);
    expect(ctx.frames).toHaveLength(1);
  });

  it("does nothing when at front (no allies in front)", () => {
    const tree = makeBattleUnit({ id: "bone_tree", name: "骨樹", atk: 1, hp: 4, skillUses: 3 });
    const board = [tree];
    const ctx = makeContext(board, []);
    handleBoneTreeAllyDeath(board, true, ctx);
    expect(ctx.frames).toHaveLength(0);
    expect(tree.skillUses).toBe(3);
  });

  it("does nothing when skillUses = 0", () => {
    const f0 = makeBattleUnit({ id: INERT_UNIT_ID, atk: 2, hp: 5 });
    const tree = makeBattleUnit({ id: "bone_tree", name: "骨樹", atk: 1, hp: 4, skillUses: 0 });
    const board = [f0, tree];
    const ctx = makeContext(board, []);
    handleBoneTreeAllyDeath(board, true, ctx);
    expect(f0.atk).toBe(2);
    expect(ctx.frames).toHaveLength(0);
  });

  it("skips dead allies in front", () => {
    const dead = makeBattleUnit({ id: INERT_UNIT_ID, atk: 2, hp: 0 });
    const alive = makeBattleUnit({ id: INERT_UNIT_ID, atk: 3, hp: 4 });
    const tree = makeBattleUnit({ id: "bone_tree", name: "骨樹", atk: 1, hp: 4, skillUses: 3 });
    const board = [dead, alive, tree];
    const ctx = makeContext(board, []);
    handleBoneTreeAllyDeath(board, true, ctx);
    const b = atLevel(BONE_TREE.buff, 1);
    expect(dead.atk).toBe(2);
    expect(alive.atk).toBe(3 + b.atk);
    expect(tree.skillUses).toBe(2);
  });

  it("does nothing when all allies in front are dead", () => {
    const dead = makeBattleUnit({ id: INERT_UNIT_ID, hp: 0 });
    const tree = makeBattleUnit({ id: "bone_tree", name: "骨樹", atk: 1, hp: 4, skillUses: 3 });
    const board = [dead, tree];
    const ctx = makeContext(board, []);
    handleBoneTreeAllyDeath(board, true, ctx);
    expect(ctx.frames).toHaveLength(0);
    expect(tree.skillUses).toBe(3);
  });
});

describe("handleCarrionSentinelAllyDeath", () => {
  it("直前の味方が死亡: 屍蝋の盾とATK+1を得る", () => {
    const sentinel = makeBattleUnit({
      id: "carrion_sentinel",
      name: "骸の見張り番",
      atk: 1,
      hp: 3,
      skillUses: 1,
    });
    // 前の素体が死んでboard[0]にsentinelが来た状態をシミュレート
    const board = [sentinel];
    const ctx = makeContext(board, []);
    handleCarrionSentinelAllyDeath(board, 0, true, ctx);
    expect(sentinel.atk).toBe(2);
    expect(sentinel.equip).toBe("corpse_wax");
    expect(sentinel.skillUses).toBe(0);
    expect(ctx.frames).toHaveLength(1);
  });

  it("直前でない味方が死亡: 発動しない", () => {
    const other = makeBattleUnit({ id: INERT_UNIT_ID, atk: 3, hp: 5 });
    const sentinel = makeBattleUnit({
      id: "carrion_sentinel",
      name: "骸の見張り番",
      atk: 1,
      hp: 3,
      skillUses: 1,
    });
    // 元board [dead, other, sentinel] → splice後 [other, sentinel], deathIdx=0
    // sentinel は idx=1 で deathIdx=0 と一致しない → 発動しない
    const board = [other, sentinel];
    const ctx = makeContext(board, []);
    handleCarrionSentinelAllyDeath(board, 0, true, ctx);
    expect(sentinel.atk).toBe(1);
    expect(sentinel.equip).toBeNull();
    expect(ctx.frames).toHaveLength(0);
  });

  it("skillUses=0 なら発動しない", () => {
    const sentinel = makeBattleUnit({
      id: "carrion_sentinel",
      name: "骸の見張り番",
      atk: 1,
      hp: 3,
      skillUses: 0,
    });
    const board = [sentinel];
    const ctx = makeContext(board, []);
    handleCarrionSentinelAllyDeath(board, 0, true, ctx);
    expect(sentinel.atk).toBe(1);
    expect(sentinel.equip).toBeNull();
    expect(ctx.frames).toHaveLength(0);
  });

  it("Lv2: 2回発動可能", () => {
    const sentinel = makeBattleUnit({
      id: "carrion_sentinel",
      name: "骸の見張り番",
      atk: 1,
      hp: 3,
      level: 2,
      skillUses: 2,
    });
    const board = [sentinel];
    const ctx = makeContext(board, []);
    // 1回目
    handleCarrionSentinelAllyDeath(board, 0, true, ctx);
    expect(sentinel.atk).toBe(2);
    expect(sentinel.skillUses).toBe(1);
    // 2回目 (equip上書き可)
    handleCarrionSentinelAllyDeath(board, 0, true, ctx);
    expect(sentinel.atk).toBe(3);
    expect(sentinel.skillUses).toBe(0);
    expect(ctx.frames).toHaveLength(2);
  });

  it("sentinelが死んでいれば発動しない", () => {
    const sentinel = makeBattleUnit({
      id: "carrion_sentinel",
      name: "骸の見張り番",
      atk: 1,
      hp: 0,
      skillUses: 1,
    });
    const board = [sentinel];
    const ctx = makeContext(board, []);
    handleCarrionSentinelAllyDeath(board, 0, true, ctx);
    expect(sentinel.atk).toBe(1);
    expect(ctx.frames).toHaveLength(0);
  });
});
