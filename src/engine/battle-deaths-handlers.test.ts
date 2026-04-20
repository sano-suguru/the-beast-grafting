import { handleEquipDeath } from "./battle-deaths-handlers";
import { makeBattleUnit, makeContext, callDeathHandler as callHandler } from "./test-helpers";
import type { BattleUnit } from "./battle-context";

describe("handleRatDeath", () => {
  it("does nothing on empty board", () => {
    const dead = makeBattleUnit({ id: "rat", name: "ネズミ" });
    const ctx = makeContext();
    callHandler("rat", dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });

  it("buffs a random ally (Lv1: +1/+1)", () => {
    const ally = makeBattleUnit({ atk: 3, hp: 5, uid: "ally-1" });
    const ctx = makeContext([ally], [], null, { next: () => 0 });
    const dead = makeBattleUnit({ id: "rat", name: "ネズミ" });
    callHandler("rat", dead, ctx.pBoard, 0, true, ctx);
    expect(ally.atk).toBe(4);
    expect(ally.hp).toBe(6);
  });

  it("buffs exactly 1 ally chosen by rng", () => {
    const a = makeBattleUnit({ atk: 1, hp: 1, uid: "a" });
    const b = makeBattleUnit({ atk: 2, hp: 2, uid: "b" });
    const c = makeBattleUnit({ atk: 3, hp: 3, uid: "c" });
    // rng=0.5 → Math.floor(0.5 * 3) = 1 → b が選ばれる
    const ctx = makeContext([a, b, c], [], null, { next: () => 0.5 });
    const dead = makeBattleUnit({ id: "rat", name: "ネズミ" });
    callHandler("rat", dead, ctx.pBoard, 0, true, ctx);
    expect(a.atk).toBe(1); // 未バフ
    expect(b.atk).toBe(3); // +1
    expect(c.atk).toBe(3); // 未バフ
  });

  it("Lv2 buffs +2/+2", () => {
    const ally = makeBattleUnit({ atk: 1, hp: 1, uid: "ally-1" });
    const ctx = makeContext([ally], [], null, { next: () => 0 });
    const dead = makeBattleUnit({ id: "rat", name: "ネズミ", level: 2 });
    callHandler("rat", dead, ctx.pBoard, 0, true, ctx);
    expect(ally.atk).toBe(3);
    expect(ally.hp).toBe(3);
  });

  it("frame action value matches actual buff (+1/+1)", () => {
    const ally = makeBattleUnit({ atk: 3, hp: 5, uid: "ally-1" });
    const ctx = makeContext([ally], [], null, { next: () => 0 });
    const dead = makeBattleUnit({ id: "rat", name: "ネズミ" });
    callHandler("rat", dead, ctx.pBoard, 0, true, ctx);
    const action = ctx.frames[0]?.actions["ally-1"];
    expect(action).toBeDefined();
    expect(action!.value).toBe("+1/+1");
  });
});

describe("handleHoundDeath", () => {
  it("spawns 1/1 token at idx 0", () => {
    const ctx = makeContext();
    const dead = makeBattleUnit({ id: "hound", name: "猟犬" });
    callHandler("hound", dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.id).toBe("token");
    expect(ctx.pBoard[0]!.atk).toBe(1);
    expect(ctx.pBoard[0]!.hp).toBe(1);
  });

  it("spawns token at correct middle position", () => {
    const a = makeBattleUnit({ uid: "a" });
    const b = makeBattleUnit({ uid: "b" });
    const ctx = makeContext([a, b]);
    const dead = makeBattleUnit({ id: "hound", name: "猟犬" });
    // Hound died at idx 1 (between a and b after a was already in board)
    callHandler("hound", dead, ctx.pBoard, 1, true, ctx);
    expect(ctx.pBoard).toHaveLength(3);
    expect(ctx.pBoard[1]!.id).toBe("token");
  });

  it("church_hound spawns token with isChurch=true", () => {
    const ctx = makeContext();
    const dead = makeBattleUnit({ id: "church_hound", name: "教会猟犬", isChurch: true });
    callHandler("church_hound", dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.pBoard[0]!.isChurch).toBe(true);
  });

  it("zealot on board buffs spawned token atk +1", () => {
    const zealot = makeBattleUnit({ id: "zealot", name: "狂信者", hp: 3 });
    const ctx = makeContext([zealot]);
    const dead = makeBattleUnit({ id: "hound", name: "猟犬" });
    callHandler("hound", dead, ctx.pBoard, 0, true, ctx);
    const token = ctx.pBoard.find((u) => u.id === "token");
    expect(token!.atk).toBe(2); // 1 base + 1 zealot
  });
});

describe("handleBeastDeath", () => {
  it("spawns a tier-3 unit as 2/2", () => {
    const ctx = makeContext([], [], null, { next: () => 0 });
    const dead = makeBattleUnit({ id: "beast", name: "腐肉獣" });
    callHandler("beast", dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.atk).toBe(2);
    expect(ctx.pBoard[0]!.hp).toBe(2);
    // Should be a real unit, not a token
    expect(ctx.pBoard[0]!.id).not.toBe("token");
  });

  it("spawned unit inherits isChurch from dead beast", () => {
    const ctx = makeContext([], [], null, { next: () => 0 });
    const dead = makeBattleUnit({ id: "beast", name: "腐肉獣", isChurch: true });
    callHandler("beast", dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.pBoard[0]!.isChurch).toBe(true);
  });

  it("zealot buffs the summoned unit", () => {
    const zealot = makeBattleUnit({ id: "zealot", name: "狂信者", hp: 3 });
    const ctx = makeContext([zealot], [], null, { next: () => 0 });
    const dead = makeBattleUnit({ id: "beast", name: "腐肉獣" });
    callHandler("beast", dead, ctx.pBoard, 0, true, ctx);
    const summoned = ctx.pBoard.find((u) => u.id !== "zealot");
    expect(summoned!.atk).toBe(3); // 2 base + 1 zealot
  });
});

describe("handleChurchBeastDeath", () => {
  it("spawns 3/3 token with isChurch=true", () => {
    const ctx = makeContext();
    const dead = makeBattleUnit({ id: "church_beast", name: "偽天使", isChurch: true });
    callHandler("church_beast", dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.name).toBe("祝福の幼子");
    expect(ctx.pBoard[0]!.atk).toBe(3);
    expect(ctx.pBoard[0]!.hp).toBe(3);
    expect(ctx.pBoard[0]!.isChurch).toBe(true);
  });
});

describe("handleSquireDeath", () => {
  it("buffs successor at idx", () => {
    const next = makeBattleUnit({ atk: 3, hp: 3, uid: "next" });
    const ctx = makeContext([next]);
    const dead = makeBattleUnit({ id: "squire", name: "従騎士" });
    // After squire removed from idx 0, next is at idx 0
    callHandler("squire", dead, ctx.pBoard, 0, true, ctx);
    expect(next.atk).toBe(4);
    expect(next.hp).toBe(4);
  });

  it("does nothing when squire was last unit (no successor)", () => {
    const ctx = makeContext();
    const dead = makeBattleUnit({ id: "squire", name: "従騎士" });
    callHandler("squire", dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });

  it("does nothing when idx is beyond board length", () => {
    const a = makeBattleUnit({ atk: 5, hp: 5 });
    const ctx = makeContext([a]);
    const dead = makeBattleUnit({ id: "squire", name: "従騎士" });
    // idx=1 is past board end (board has 1 element at idx 0)
    callHandler("squire", dead, ctx.pBoard, 1, true, ctx);
    expect(a.atk).toBe(5); // unchanged
    expect(ctx.frames).toHaveLength(0);
  });
});

describe("handlePriestDeath", () => {
  it("buffs all remaining allies +0/+1 HP", () => {
    const a = makeBattleUnit({ hp: 3, uid: "a" });
    const b = makeBattleUnit({ hp: 2, uid: "b" });
    const c = makeBattleUnit({ hp: 1, uid: "c" });
    const ctx = makeContext([a, b, c]);
    const dead = makeBattleUnit({ id: "priest", name: "司祭" });
    callHandler("priest", dead, ctx.pBoard, 0, true, ctx);
    expect(a.hp).toBe(4);
    expect(b.hp).toBe(3);
    expect(c.hp).toBe(2);
  });

  it("does nothing on empty board", () => {
    const ctx = makeContext();
    const dead = makeBattleUnit({ id: "priest", name: "司祭" });
    callHandler("priest", dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });

  it("generates frame with buff action for every ally", () => {
    const a = makeBattleUnit({ hp: 3, uid: "a" });
    const b = makeBattleUnit({ hp: 2, uid: "b" });
    const ctx = makeContext([a, b]);
    const dead = makeBattleUnit({ id: "priest", name: "司祭" });
    callHandler("priest", dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.frames).toHaveLength(1);
    expect(ctx.frames[0]!.actions["a"]).toEqual({
      type: "buff",
      value: "+0/+1",
      buff: { atk: 0, hp: 1 },
      source: dead.uid,
    });
    expect(ctx.frames[0]!.actions["b"]).toEqual({
      type: "buff",
      value: "+0/+1",
      buff: { atk: 0, hp: 1 },
      source: dead.uid,
    });
  });
});

describe("handleMaidenDeath", () => {
  it("Lv1: grants corpse_wax to immediate successor only", () => {
    const next = makeBattleUnit({ equip: null, uid: "next" });
    const other = makeBattleUnit({ equip: null, uid: "other" });
    const ctx = makeContext([next, other]);
    const dead = makeBattleUnit({ id: "maiden", name: "処女", level: 1 });
    callHandler("maiden", dead, ctx.pBoard, 0, true, ctx);
    expect(next.equip).toBe("corpse_wax");
    expect(other.equip).toBeNull();
  });

  it("Lv2: grants corpse_wax to 2 successors", () => {
    const a = makeBattleUnit({ equip: null, uid: "a" });
    const b = makeBattleUnit({ equip: null, uid: "b" });
    const c = makeBattleUnit({ equip: null, uid: "c" });
    const ctx = makeContext([a, b, c]);
    const dead = makeBattleUnit({ id: "maiden", name: "処女", level: 2 });
    callHandler("maiden", dead, ctx.pBoard, 0, true, ctx);
    expect(a.equip).toBe("corpse_wax");
    expect(b.equip).toBe("corpse_wax");
    expect(c.equip).toBeNull();
  });

  it("does nothing when maiden was last unit", () => {
    const ctx = makeContext();
    const dead = makeBattleUnit({ id: "maiden", name: "処女", level: 1 });
    callHandler("maiden", dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });

  it("overwrites existing equip on target", () => {
    const next = makeBattleUnit({ equip: "iron_plate" as const, uid: "next" });
    const ctx = makeContext([next]);
    const dead = makeBattleUnit({ id: "maiden", name: "処女", level: 1 });
    callHandler("maiden", dead, ctx.pBoard, 0, true, ctx);
    expect(next.equip).toBe("corpse_wax");
  });
});

describe("handleMartyrDeath", () => {
  it("buffs next 2 units +1/+1 each", () => {
    const a = makeBattleUnit({ atk: 2, hp: 2, uid: "a" });
    const b = makeBattleUnit({ atk: 3, hp: 3, uid: "b" });
    const c = makeBattleUnit({ atk: 4, hp: 4, uid: "c" });
    const ctx = makeContext([a, b, c]);
    const dead = makeBattleUnit({ id: "martyr", name: "殉教者" });
    // Martyr died at idx 0, so a(idx0) and b(idx1) are next 2
    callHandler("martyr", dead, ctx.pBoard, 0, true, ctx);
    expect(a.atk).toBe(3);
    expect(a.hp).toBe(3);
    expect(b.atk).toBe(4);
    expect(b.hp).toBe(4);
    // c should be untouched
    expect(c.atk).toBe(4);
    expect(c.hp).toBe(4);
  });

  it("buffs only 1 unit when only 1 successor exists", () => {
    const a = makeBattleUnit({ atk: 2, hp: 2, uid: "a" });
    const ctx = makeContext([a]);
    const dead = makeBattleUnit({ id: "martyr", name: "殉教者" });
    callHandler("martyr", dead, ctx.pBoard, 0, true, ctx);
    expect(a.atk).toBe(3);
    expect(a.hp).toBe(3);
    expect(ctx.frames).toHaveLength(1);
  });

  it("does nothing when no successors", () => {
    const ctx = makeContext();
    const dead = makeBattleUnit({ id: "martyr", name: "殉教者" });
    callHandler("martyr", dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });

  it("generates separate frames per target", () => {
    const a = makeBattleUnit({ atk: 2, hp: 2, uid: "a" });
    const b = makeBattleUnit({ atk: 3, hp: 3, uid: "b" });
    const ctx = makeContext([a, b]);
    const dead = makeBattleUnit({ id: "martyr", name: "殉教者" });
    callHandler("martyr", dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.frames).toHaveLength(2);
  });
});

describe("handleSpiteBeastDeath", () => {
  it("Lv1: 攻撃の50%ダメを後継者と敵前衛に与える", () => {
    const successor = makeBattleUnit({ hp: 10, uid: "successor" });
    const enemyFront = makeBattleUnit({ hp: 10, uid: "enemy-front" });
    const ctx = makeContext([successor], [enemyFront]);
    const dead = makeBattleUnit({ id: "spite_beast", name: "道連れの獣", atk: 6, level: 1 });
    callHandler("spite_beast", dead, ctx.pBoard, 0, true, ctx);
    expect(successor.hp).toBe(7); // 10 - 3 (50% of 6)
    expect(enemyFront.hp).toBe(7);
  });

  it("Lv2: 攻撃の100%ダメ", () => {
    const successor = makeBattleUnit({ hp: 10, uid: "successor" });
    const enemyFront = makeBattleUnit({ hp: 10, uid: "enemy-front" });
    const ctx = makeContext([successor], [enemyFront]);
    const dead = makeBattleUnit({ id: "spite_beast", name: "道連れの獣", atk: 6, level: 2 });
    callHandler("spite_beast", dead, ctx.pBoard, 0, true, ctx);
    expect(successor.hp).toBe(4); // 10 - 6 (100%)
    expect(enemyFront.hp).toBe(4);
  });

  it("Lv3: 攻撃の150%ダメ", () => {
    const successor = makeBattleUnit({ hp: 10, uid: "successor" });
    const enemyFront = makeBattleUnit({ hp: 10, uid: "enemy-front" });
    const ctx = makeContext([successor], [enemyFront]);
    const dead = makeBattleUnit({ id: "spite_beast", name: "道連れの獣", atk: 6, level: 3 });
    callHandler("spite_beast", dead, ctx.pBoard, 0, true, ctx);
    expect(successor.hp).toBe(1); // 10 - 9 (150%)
    expect(enemyFront.hp).toBe(1);
  });

  it("後継者なし → 敵前衛のみダメージ", () => {
    const enemyFront = makeBattleUnit({ hp: 10, uid: "enemy-front" });
    const ctx = makeContext([], [enemyFront]);
    const dead = makeBattleUnit({ id: "spite_beast", name: "道連れの獣", atk: 6, level: 1 });
    callHandler("spite_beast", dead, ctx.pBoard, 0, true, ctx);
    expect(enemyFront.hp).toBe(7);
    expect(ctx.frames).toHaveLength(1);
  });

  it("敵前衛なし → 後継者のみダメージ", () => {
    const successor = makeBattleUnit({ hp: 10, uid: "successor" });
    const ctx = makeContext([successor], []);
    const dead = makeBattleUnit({ id: "spite_beast", name: "道連れの獣", atk: 6, level: 1 });
    callHandler("spite_beast", dead, ctx.pBoard, 0, true, ctx);
    expect(successor.hp).toBe(7);
    expect(ctx.frames).toHaveLength(1);
  });

  it("対象なし → フレーム生成なし", () => {
    const ctx = makeContext([], []);
    const dead = makeBattleUnit({ id: "spite_beast", name: "道連れの獣", atk: 6, level: 1 });
    callHandler("spite_beast", dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });

  it("isPlayer=false → 敵味方のボードが反転する", () => {
    const successor = makeBattleUnit({ hp: 10, uid: "successor" });
    const enemyFront = makeBattleUnit({ hp: 10, uid: "enemy-front" });
    // isPlayer=false なので eBoard が「自分側」、pBoard が「敵側」
    const ctx = makeContext([enemyFront], [successor]);
    const dead = makeBattleUnit({ id: "spite_beast", name: "道連れの獣", atk: 6, level: 1 });
    callHandler("spite_beast", dead, ctx.eBoard, 0, false, ctx);
    expect(successor.hp).toBe(7); // eBoard[0] が後継者
    expect(enemyFront.hp).toBe(7); // pBoard[0] が敵前衛
  });

  it("奇数ATKは端数切り捨て (ATK=5, Lv1=50% → 2ダメ)", () => {
    const successor = makeBattleUnit({ hp: 10, uid: "successor" });
    const enemyFront = makeBattleUnit({ hp: 10, uid: "enemy-front" });
    const ctx = makeContext([successor], [enemyFront]);
    const dead = makeBattleUnit({ id: "spite_beast", name: "道連れの獣", atk: 5, level: 1 });
    callHandler("spite_beast", dead, ctx.pBoard, 0, true, ctx);
    expect(successor.hp).toBe(8); // 10 - 2 (floor(5*50/100))
    expect(enemyFront.hp).toBe(8);
  });
});

describe("handleEquipDeath", () => {
  it("maggot_nest spawns 1/1 token at death position", () => {
    const ally = makeBattleUnit({ uid: "ally" });
    const board = [ally];
    const ctx = makeContext(board);
    const dead = makeBattleUnit({ equip: "maggot", name: "ユニット" });
    handleEquipDeath(dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.pBoard).toHaveLength(2);
    expect(ctx.pBoard[0]!.name).toBe("巨大蛆虫");
    expect(ctx.pBoard[0]!.atk).toBe(1);
    expect(ctx.pBoard[0]!.hp).toBe(1);
  });

  it("death_curse spawns 1/1 copy preserving dead unit name", () => {
    const board: BattleUnit[] = [];
    const ctx = makeContext(board);
    const dead = makeBattleUnit({ equip: "death_curse", name: "テスト兵士" });
    handleEquipDeath(dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.name).toBe("テスト兵士");
    expect(ctx.pBoard[0]!.atk).toBe(1);
    expect(ctx.pBoard[0]!.hp).toBe(1);
  });

  it("does nothing for units with no equip", () => {
    const ctx = makeContext();
    const dead = makeBattleUnit({ equip: null });
    handleEquipDeath(dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.pBoard).toHaveLength(0);
    expect(ctx.frames).toHaveLength(0);
  });

  it("does nothing for non-death equips like iron", () => {
    const ctx = makeContext();
    const dead = makeBattleUnit({ equip: "iron_plate" });
    handleEquipDeath(dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.pBoard).toHaveLength(0);
    expect(ctx.frames).toHaveLength(0);
  });

  it("maggot_nest token receives zealot buff", () => {
    const zealot = makeBattleUnit({ id: "zealot", name: "狂信者", hp: 3 });
    const ctx = makeContext([zealot]);
    const dead = makeBattleUnit({ equip: "maggot", name: "ユニット" });
    handleEquipDeath(dead, ctx.pBoard, 0, true, ctx);
    const token = ctx.pBoard.find((u) => u.name === "巨大蛆虫");
    expect(token!.atk).toBe(2); // 1 base + 1 zealot
  });

  it("death_curse token receives zealot buff", () => {
    const zealot = makeBattleUnit({ id: "zealot", name: "狂信者", hp: 3 });
    const ctx = makeContext([zealot]);
    const dead = makeBattleUnit({ equip: "death_curse", name: "呪兵" });
    handleEquipDeath(dead, ctx.pBoard, 0, true, ctx);
    const token = ctx.pBoard.find((u) => u.name === "呪兵");
    expect(token!.atk).toBe(2); // 1 base + 1 zealot
  });
});
