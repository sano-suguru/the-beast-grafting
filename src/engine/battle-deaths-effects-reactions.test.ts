import { resolveDeaths } from "./battle-deaths";
import { handleBeelzebubSpawns } from "./battle-deaths-effects-reactions";
import {
  makeBattleUnit,
  makeContext,
  segmentsToPlainText,
  callDeathHandler as callHandler,
} from "./test-helpers";
import { MAX_BOARD_SIZE } from "./constants";
import { atLevel, CROW, SIN_EATER, CATHEDRAL } from "../shared/skill-params";

describe("handleBeelzebubSpawns", () => {
  it("spawns 3/3 fly when beelzebub is alive", () => {
    const beelzebub = makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", atk: 4, hp: 4 });
    const ctx = makeContext([beelzebub]);
    handleBeelzebubSpawns(ctx.pBoard, true, ctx, 0);
    const fly = ctx.pBoard.find((u) => u.name === "腐肉の蠅");
    expect(fly).toBeDefined();
    expect(fly!.atk).toBe(3);
    expect(fly!.hp).toBe(3);
  });

  it("player and enemy fly spawns are independent", () => {
    const pBeelzebub = makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", hp: 4 });
    const eBeelzebub = makeBattleUnit({ id: "beelzebub", name: "敵ベルゼブブ", hp: 4 });
    const ctx = makeContext([pBeelzebub], [eBeelzebub]);
    handleBeelzebubSpawns(ctx.pBoard, true, ctx, 0);
    handleBeelzebubSpawns(ctx.eBoard, false, ctx, 0);
    expect(ctx.pBoard.filter((u) => u.name === "腐肉の蠅")).toHaveLength(1);
    expect(ctx.eBoard.filter((u) => u.name === "腐肉の蠅")).toHaveLength(1);
  });

  it("flies get zealot buff if zealot present", () => {
    const zealot = makeBattleUnit({ id: "zealot", name: "狂信者", hp: 3 });
    const beelzebub = makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", hp: 4 });
    const ctx = makeContext([zealot, beelzebub]);
    handleBeelzebubSpawns(ctx.pBoard, true, ctx, 0);
    const fly = ctx.pBoard.find((u) => u.name === "腐肉の蠅");
    expect(fly!.atk).toBe(4); // 3 base + 1 zealot
  });

  it("does not trigger when no beelzebub on board", () => {
    const ally = makeBattleUnit({ id: "rat", hp: 5 });
    const ctx = makeContext([ally]);
    handleBeelzebubSpawns(ctx.pBoard, true, ctx, 0);
    expect(ctx.pBoard.filter((u) => u.name === "腐肉の蠅")).toHaveLength(0);
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

describe("handleBeelzebubSpawns – board size guard", () => {
  it("stops spawning when board reaches MAX_BOARD_SIZE", () => {
    const filler = Array.from({ length: MAX_BOARD_SIZE - 1 }, () => makeBattleUnit({ hp: 5 }));
    const beelzebub = makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", atk: 4, hp: 4 });
    const board = [beelzebub, ...filler];
    // board.length = 5 (MAX_BOARD_SIZE), so no flies should spawn
    const ctx = makeContext(board, []);
    handleBeelzebubSpawns(board, true, ctx, 0);
    expect(board).toHaveLength(MAX_BOARD_SIZE);
    expect(board.filter((u) => u.name === "腐肉の蠅")).toHaveLength(0);
  });

  it("spawns only until board is full", () => {
    const beelzebub = makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", atk: 4, hp: 4 });
    const brains = makeBattleUnit({ id: "brains", name: "双子脳", atk: 6, hp: 4 });
    // board = 3 units, MAX_BOARD_SIZE = 5, brains doubles → wants 2 flies, room for 2
    const board = [beelzebub, brains, makeBattleUnit({ hp: 5 })];
    const ctx = makeContext(board, []);
    handleBeelzebubSpawns(board, true, ctx, 0);
    expect(board.length).toBe(MAX_BOARD_SIZE);
    expect(board.filter((u) => u.name === "腐肉の蠅")).toHaveLength(2);
  });
});

describe("resolveDeaths – cathedral spawns on ally death", () => {
  it("spawns a token and decrements skillUses", () => {
    // dead.id must not be "token" — cathedral spawn is gated by dead.id !== "token"
    const dying = makeBattleUnit({ id: "beggar", hp: 0 });
    const cathedral = makeBattleUnit({
      id: "cathedral",
      name: "礼拝堂",
      atk: 1,
      hp: 8,
      skillUses: 2,
    });
    const enemy = makeBattleUnit({ hp: 20 });
    const ctx = makeContext([dying, cathedral], [enemy]);
    resolveDeaths(ctx);
    const t = atLevel(CATHEDRAL.token, 1);
    const token = ctx.pBoard.find((u) => u.name === "信徒");
    expect(token).toBeDefined();
    expect(token!.atk).toBe(t.atk);
    expect(token!.hp).toBe(t.hp);
    expect(cathedral.skillUses).toBe(1);
  });

  it("does not spawn when skillUses exhausted", () => {
    const dying = makeBattleUnit({ id: "beggar", hp: 0 });
    const cathedral = makeBattleUnit({
      id: "cathedral",
      name: "礼拝堂",
      atk: 1,
      hp: 8,
      skillUses: 0,
    });
    const ctx = makeContext([dying, cathedral], [makeBattleUnit({ hp: 20 })]);
    resolveDeaths(ctx);
    expect(ctx.pBoard.filter((u) => u.name === "信徒")).toHaveLength(0);
  });
});

describe("resolveDeaths – crow gains stats on ally death", () => {
  it("buffs crow when an ally dies", () => {
    const dying = makeBattleUnit({ id: "beggar", hp: 0 });
    const crow = makeBattleUnit({ id: "crow", name: "鴉", atk: 2, hp: 1, skillUses: 2 });
    const ctx = makeContext([dying, crow], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const b = atLevel(CROW.buff, 1);
    expect(crow.atk).toBe(2 + b.atk);
    expect(crow.hp).toBe(1 + b.hp);
    expect(crow.skillUses).toBe(1);
  });
});

describe("resolveDeaths – sin_eater absorbs dead atk", () => {
  const uses = atLevel(SIN_EATER.uses, 1);

  it("absorbs dead unit atk up to cap", () => {
    const dying = makeBattleUnit({ id: "beggar", atk: 10, hp: 0 });
    const eater = makeBattleUnit({ id: "sin_eater", name: "黒蟲", atk: 3, hp: 4, skillUses: uses });
    const ctx = makeContext([dying, eater], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const cap = atLevel(SIN_EATER.atkCap, 1);
    expect(eater.atk).toBe(3 + Math.min(10, cap));
  });

  it("caps absorption at level-based limit", () => {
    const dying = makeBattleUnit({ id: "beggar", atk: 100, hp: 0 });
    const eater = makeBattleUnit({ id: "sin_eater", name: "黒蟲", atk: 3, hp: 4, skillUses: uses });
    const ctx = makeContext([dying, eater], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const cap = atLevel(SIN_EATER.atkCap, 1);
    expect(eater.atk).toBe(3 + cap);
  });

  it("stops absorbing after uses are exhausted", () => {
    const cap = atLevel(SIN_EATER.atkCap, 1);
    const eater = makeBattleUnit({
      id: "sin_eater",
      name: "黒蟲",
      atk: 3,
      hp: 10,
      skillUses: uses,
    });
    // uses 回 + 1 回死亡させる → uses 回目まで吸収、それ以降は吸収しない
    const dying = Array.from({ length: uses + 1 }, () =>
      makeBattleUnit({ id: "beggar", atk: 10, hp: 0 }),
    );
    const ctx = makeContext([...dying, eater], [makeBattleUnit({ hp: 50 })]);
    resolveDeaths(ctx);
    expect(eater.atk).toBe(3 + cap * uses);
    expect(eater.skillUses).toBe(0);
  });
});
