import { getDeathHandler, handleEquipDeath } from "./battle-deaths-handlers";
import { handleBeelzebubSpawns } from "./battle-deaths-effects-reactions";
import type { DeathHandlerUnitId } from "./battle-deaths-handlers";
import { makeBattleUnit, makeContext } from "./test-helpers";
import type { BattleUnit } from "./battle-context";
import { invariant } from "../shared/invariant";
import { segmentsToPlainText } from "./test-helpers";

function callHandler(
  id: DeathHandlerUnitId,
  dead: BattleUnit,
  board: BattleUnit[],
  idx: number,
  isPlayer: boolean,
  ctx: ReturnType<typeof makeContext>,
  successor: BattleUnit | null = idx < board.length ? (board[idx] ?? null) : null,
  successor2: BattleUnit | null = idx + 1 < board.length ? (board[idx + 1] ?? null) : null,
) {
  const handler = getDeathHandler(id);
  invariant(handler, `no death handler for "${id}"`);
  handler({ dead, board, idx, isPlayer, ctx, successor, successor2 });
}

describe("handleRatDeath", () => {
  it("does nothing on empty board", () => {
    const dead = makeBattleUnit({ id: "rat", name: "ネズミ" });
    const ctx = makeContext();
    callHandler("rat", dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });

  it("buffs the only remaining ally +1/+1", () => {
    const ally = makeBattleUnit({ atk: 3, hp: 5, uid: "ally-1" });
    const ctx = makeContext([ally], [], null, { next: () => 0 });
    const dead = makeBattleUnit({ id: "rat", name: "ネズミ" });
    callHandler("rat", dead, ctx.pBoard, 0, true, ctx);
    expect(ally.atk).toBe(4);
    expect(ally.hp).toBe(6);
  });

  it("selects last ally when random is 0.99", () => {
    const a = makeBattleUnit({ atk: 1, hp: 1, uid: "a" });
    const b = makeBattleUnit({ atk: 2, hp: 2, uid: "b" });
    const c = makeBattleUnit({ atk: 3, hp: 3, uid: "c" });
    const ctx = makeContext([a, b, c], [], null, { next: () => 0.99 });
    const dead = makeBattleUnit({ id: "rat", name: "ネズミ" });
    callHandler("rat", dead, ctx.pBoard, 0, true, ctx);
    // Math.floor(0.99 * 3) = 2, so c is targeted
    expect(c.atk).toBe(4);
    expect(c.hp).toBe(4);
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
  it("spawns 2/2 token with isChurch=true", () => {
    const ctx = makeContext();
    const dead = makeBattleUnit({ id: "church_beast", name: "偽天使", isChurch: true });
    callHandler("church_beast", dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.name).toBe("祝福の幼子");
    expect(ctx.pBoard[0]!.atk).toBe(2);
    expect(ctx.pBoard[0]!.hp).toBe(2);
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
    expect(ctx.frames[0]!.actions["a"]).toEqual({ type: "buff", value: "+0/+1" });
    expect(ctx.frames[0]!.actions["b"]).toEqual({ type: "buff", value: "+0/+1" });
  });
});

describe("handleMaidenDeath", () => {
  it("grants corpse_wax to immediate successor", () => {
    const next = makeBattleUnit({ equip: null, uid: "next" });
    const ctx = makeContext([next]);
    const dead = makeBattleUnit({ id: "maiden", name: "処女" });
    callHandler("maiden", dead, ctx.pBoard, 0, true, ctx);
    expect(next.equip).toBe("corpse_wax");
  });

  it("does nothing when maiden was last unit", () => {
    const ctx = makeContext();
    const dead = makeBattleUnit({ id: "maiden", name: "処女" });
    callHandler("maiden", dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });

  it("overwrites existing equip on target", () => {
    const next = makeBattleUnit({ equip: "iron", uid: "next" });
    const ctx = makeContext([next]);
    const dead = makeBattleUnit({ id: "maiden", name: "処女" });
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

describe("handleEquipDeath", () => {
  it("maggot_nest spawns 1/1 token at death position", () => {
    const ally = makeBattleUnit({ uid: "ally" });
    const board = [ally];
    const ctx = makeContext(board);
    const dead = makeBattleUnit({ equip: "maggot_nest", name: "ユニット" });
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
    const dead = makeBattleUnit({ equip: "iron" });
    handleEquipDeath(dead, ctx.pBoard, 0, true, ctx);
    expect(ctx.pBoard).toHaveLength(0);
    expect(ctx.frames).toHaveLength(0);
  });

  it("maggot_nest token receives zealot buff", () => {
    const zealot = makeBattleUnit({ id: "zealot", name: "狂信者", hp: 3 });
    const ctx = makeContext([zealot]);
    const dead = makeBattleUnit({ equip: "maggot_nest", name: "ユニット" });
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

describe("handleBeelzebubSpawns", () => {
  it("spawns 4/4 fly when beelzebub is alive", () => {
    const beelzebub = makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", atk: 4, hp: 4 });
    const ctx = makeContext([beelzebub]);
    handleBeelzebubSpawns(ctx.pBoard, true, ctx, 0);
    const fly = ctx.pBoard.find((u) => u.name === "腐肉の蠅");
    expect(fly).toBeDefined();
    expect(fly!.atk).toBe(4);
    expect(fly!.hp).toBe(4);
    expect(ctx.pFlyCount).toBe(1);
  });

  it("does not spawn when flyCount is already 3", () => {
    const beelzebub = makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", atk: 4, hp: 4 });
    const ctx = makeContext([beelzebub]);
    ctx.pFlyCount = 3;
    const boardBefore = ctx.pBoard.length;
    handleBeelzebubSpawns(ctx.pBoard, true, ctx, 0);
    expect(ctx.pBoard.length).toBe(boardBefore);
    expect(ctx.pFlyCount).toBe(3);
  });

  it("player and enemy fly counters are independent", () => {
    const pBeelzebub = makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", hp: 4 });
    const eBeelzebub = makeBattleUnit({ id: "beelzebub", name: "敵ベルゼブブ", hp: 4 });
    const ctx = makeContext([pBeelzebub], [eBeelzebub]);
    handleBeelzebubSpawns(ctx.pBoard, true, ctx, 0);
    handleBeelzebubSpawns(ctx.eBoard, false, ctx, 0);
    expect(ctx.pFlyCount).toBe(1);
    expect(ctx.eFlyCount).toBe(1);
  });

  it("flies get zealot buff if zealot present", () => {
    const zealot = makeBattleUnit({ id: "zealot", name: "狂信者", hp: 3 });
    const beelzebub = makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", hp: 4 });
    const ctx = makeContext([zealot, beelzebub]);
    handleBeelzebubSpawns(ctx.pBoard, true, ctx, 0);
    const fly = ctx.pBoard.find((u) => u.name === "腐肉の蠅");
    expect(fly!.atk).toBe(5); // 4 base + 1 zealot
  });

  it("does not trigger when no beelzebub on board", () => {
    const ally = makeBattleUnit({ id: "rat", hp: 5 });
    const ctx = makeContext([ally]);
    handleBeelzebubSpawns(ctx.pBoard, true, ctx, 0);
    expect(ctx.pFlyCount).toBe(0);
  });
});

describe("enemy-side prefix", () => {
  it("rat death frame includes 敵の prefix for enemy side", () => {
    const ally = makeBattleUnit({ uid: "e1", hp: 5 });
    const ctx = makeContext([], [ally], null, { next: () => 0 });
    const dead = makeBattleUnit({ id: "rat", name: "ネズミ" });
    callHandler("rat", dead, ctx.eBoard, 0, false, ctx);
    expect(segmentsToPlainText(ctx.frames[0]!.log.segments)).toContain("敵の");
  });
});
