import {
  handleCrawlingCordBuff,
  handleInsatiableMawBuff,
} from "./battle-deaths-effects-ally-reactions";
import { makeBattleUnit, makeContext, INERT_UNIT_ID } from "./test-helpers";
import { atLevel, CRAWLING_CORD, INSATIABLE_MAW } from "../shared/skill-params";

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
