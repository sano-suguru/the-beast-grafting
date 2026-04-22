import {
  handleInsatiableMawBuff,
  handleCarrionSentinelAllyDeath,
} from "./battle-deaths-effects-ally-reactions";
import { makeBattleUnit, makeContext, INERT_UNIT_ID } from "./test-helpers";
import { atLevel, INSATIABLE_MAW } from "../shared/skill-params";
describe("handleInsatiableMawBuff", () => {
  it("buffs self on ally death", () => {
    const maw = makeBattleUnit({
      id: "insatiable_maw",
      name: "飽くなき咢",
      atk: 4,
      hp: 4,
    });
    const board = [maw];
    const ctx = makeContext(board, []);
    handleInsatiableMawBuff(board, true, ctx);
    const b = atLevel(INSATIABLE_MAW.buff, 1);
    expect(maw.atk).toBe(4 + b.atk);
    expect(maw.hp).toBe(4 + b.hp);
    expect(ctx.frames).toHaveLength(1);
  });

  it("fires unlimited times regardless of skillUses state", () => {
    const maw = makeBattleUnit({
      id: "insatiable_maw",
      name: "飽くなき咢",
      atk: 4,
      hp: 4,
      skillUses: 0,
    });
    const board = [maw];
    const ctx = makeContext(board, []);
    const b = atLevel(INSATIABLE_MAW.buff, 1);
    for (let i = 0; i < 5; i++) handleInsatiableMawBuff(board, true, ctx);
    expect(maw.atk).toBe(4 + b.atk * 5);
    expect(maw.hp).toBe(4 + b.hp * 5);
    expect(ctx.frames).toHaveLength(5);
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
