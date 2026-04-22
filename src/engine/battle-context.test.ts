import { getBrainsRepeatLevel, runWithBrainsRepeat, pushFrame } from "./battle-context";
import { createToken } from "./battle-spawn";
import { makeBattleUnit, makeContext, segmentsToPlainText } from "./test-helpers";
import { MAX_OPS } from "./constants";

describe("getBrainsRepeatLevel", () => {
  it("returns null when brains is in front (unit is behind brains)", () => {
    const board = [makeBattleUnit({ id: "brains" }), makeBattleUnit()];
    expect(getBrainsRepeatLevel(board, 1)).toBeNull();
  });

  it("returns brains level when right neighbor is brains (lv1→1)", () => {
    const board = [makeBattleUnit(), makeBattleUnit({ id: "brains", level: 1 })];
    expect(getBrainsRepeatLevel(board, 0)).toBe(1);
  });

  it("returns brains level when right neighbor is brains (lv3→3)", () => {
    const board = [makeBattleUnit(), makeBattleUnit({ id: "brains", level: 3 })];
    expect(getBrainsRepeatLevel(board, 0)).toBe(3);
  });

  it("returns null when no adjacent brains", () => {
    const board = [makeBattleUnit(), makeBattleUnit(), makeBattleUnit()];
    expect(getBrainsRepeatLevel(board, 1)).toBeNull();
  });

  it("returns null for last index with no right neighbor", () => {
    const board = [makeBattleUnit(), makeBattleUnit()];
    expect(getBrainsRepeatLevel(board, 1)).toBeNull();
  });

  it("returns null when brains is dead", () => {
    const board = [makeBattleUnit(), makeBattleUnit({ id: "brains", hp: 0 })];
    expect(getBrainsRepeatLevel(board, 0)).toBeNull();
  });
});

describe("runWithBrainsRepeat", () => {
  it("fires fn once when no brains behind", () => {
    const u = makeBattleUnit();
    const board = [u];
    let count = 0;
    runWithBrainsRepeat(u, board, 0, () => {
      count++;
    });
    expect(count).toBe(1);
  });

  it("fires fn twice when brains is behind", () => {
    const u = makeBattleUnit();
    const board = [u, makeBattleUnit({ id: "brains", level: 2 })];
    let count = 0;
    runWithBrainsRepeat(u, board, 0, () => {
      count++;
    });
    expect(count).toBe(2);
  });

  it("passes brains level to fn via u.level on the repeat call", () => {
    const u = makeBattleUnit({ level: 1 });
    const board = [u, makeBattleUnit({ id: "brains", level: 3 })];
    const levels: number[] = [];
    runWithBrainsRepeat(u, board, 0, () => {
      levels.push(u.level);
    });
    expect(levels).toEqual([1, 3]);
    // u.level is restored after
    expect(u.level).toBe(1);
  });

  it("does not fire the repeat when u dies during the first call", () => {
    const u = makeBattleUnit({ hp: 1 });
    const board = [u, makeBattleUnit({ id: "brains", level: 2 })];
    let count = 0;
    runWithBrainsRepeat(u, board, 0, () => {
      count++;
      u.hp = 0;
    });
    expect(count).toBe(1);
  });
});

describe("createToken", () => {
  it("creates a token with correct stats", () => {
    const token = createToken("巨大蛆虫", 1, 1, "p");
    expect(token.name).toBe("巨大蛆虫");
    expect(token.atk).toBe(1);
    expect(token.hp).toBe(1);
    expect(token.baseAtk).toBe(1);
    expect(token.baseHp).toBe(1);
  });

  it("sets id to 'token'", () => {
    const token = createToken("test", 3, 5, "p");
    expect(token.id).toBe("token");
  });

  it("sets default properties correctly", () => {
    const token = createToken("test", 1, 1, "p");
    expect(token.equip).toBeNull();
    expect(token.level).toBe(1);
    expect(token.tier).toBe(1);
    expect(token.exp).toBe(0);
    expect(token.isChurch).toBe(false);
  });

  it("sets isChurch when specified", () => {
    const token = createToken("祝福された幼子", 2, 2, "p", true);
    expect(token.isChurch).toBe(true);
  });

  it("generates a unique uid", () => {
    const token1 = createToken("a", 1, 1, "p");
    const token2 = createToken("b", 1, 1, "p");
    expect(token1.uid).not.toBe(token2.uid);
  });
});

describe("pushFrame", () => {
  it("sets opLimitExceeded when opCount exceeds MAX_OPS", () => {
    const ctx = makeContext();
    ctx.opCount = MAX_OPS;
    pushFrame(ctx, "info", () => ["test"], "info");
    expect(ctx.opLimitExceeded).toBe(true);
    expect(ctx.frames).toHaveLength(0);
  });

  it("adds frame normally at opCount = MAX_OPS - 1", () => {
    const ctx = makeContext();
    ctx.opCount = MAX_OPS - 1;
    pushFrame(ctx, "info", () => ["boundary test"], "info");
    expect(ctx.opLimitExceeded).toBe(false);
    expect(ctx.frames).toHaveLength(1);
    expect(segmentsToPlainText(ctx.frames[0]!.log.segments)).toBe("boundary test");
  });
});
