import {
  handleCrawlingCordBuff,
  handleInsatiableMawBuff,
  handleBoneTreeAllyDeath,
} from "./battle-deaths-effects-ally-reactions";
import { makeBattleUnit, makeContext, INERT_UNIT_ID } from "./test-helpers";
import { atLevel, CRAWLING_CORD, INSATIABLE_MAW, BONE_TREE } from "../shared/skill-params";

describe("handleCrawlingCordBuff", () => {
  it("buffs adjacent ally on ally death", () => {
    const cord = makeBattleUnit({
      id: "crawling_cord",
      name: "這い回る臍帯",
      atk: 2,
      hp: 3,
      skillUses: 1,
    });
    const ally = makeBattleUnit({ id: INERT_UNIT_ID, atk: 3, hp: 4 });
    const board = [cord, ally];
    const ctx = makeContext(board, []);
    handleCrawlingCordBuff(board, true, ctx);
    const b = atLevel(CRAWLING_CORD.buff, 1);
    expect(ally.atk).toBe(3 + b.atk);
    expect(ally.hp).toBe(4 + b.hp);
    expect(ctx.frames).toHaveLength(1);
  });

  it("does nothing when no other living allies", () => {
    const cord = makeBattleUnit({
      id: "crawling_cord",
      name: "這い回る臍帯",
      atk: 2,
      hp: 3,
      skillUses: 1,
    });
    const board = [cord];
    const ctx = makeContext(board, []);
    handleCrawlingCordBuff(board, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });

  it("only buffs adjacent units, not distant ones", () => {
    const far = makeBattleUnit({ id: INERT_UNIT_ID, atk: 3, hp: 4 });
    const mid = makeBattleUnit({ id: INERT_UNIT_ID, atk: 3, hp: 4 });
    const cord = makeBattleUnit({
      id: "crawling_cord",
      name: "這い回る臍帯",
      atk: 2,
      hp: 3,
      skillUses: 1,
    });
    // board: [far, mid, cord] → cord at index 2, adjacent is mid (index 1)
    const board = [far, mid, cord];
    const ctx = makeContext(board, []);
    handleCrawlingCordBuff(board, true, ctx);
    const b = atLevel(CRAWLING_CORD.buff, 1);
    expect(mid.atk).toBe(3 + b.atk);
    expect(mid.hp).toBe(4 + b.hp);
    // far (index 0) is NOT adjacent to cord (index 2)
    expect(far.atk).toBe(3);
    expect(far.hp).toBe(4);
  });
});

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
