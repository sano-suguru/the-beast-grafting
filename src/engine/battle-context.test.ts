import { getMult, createToken, pushFrame } from "./battle-context";
import type { BattleUnit } from "./battle-context";
import { makeContext } from "./test-helpers";
import { MAX_OPS } from "./constants";
import { segmentsToPlainText } from "./test-helpers";

function makeBattleUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: "rat",
    name: "疫病ネズミ",
    baseAtk: 2,
    baseHp: 1,
    buffAtk: 0,
    buffHp: 0,
    tier: 1,
    skillText: "",
    lore: "",
    atk: 2,
    hp: 1,
    battleBaseAtk: 2,
    battleBaseHp: 1,
    level: 1,
    exp: 0,
    equip: null,
    uid: "test-uid",
    isChurch: false,
    skillUses: 0,
    equipUses: 0,
    ...overrides,
  };
}

describe("getMult", () => {
  it("returns 1 when brains is in front (unit is behind brains)", () => {
    const board = [makeBattleUnit({ id: "brains" }), makeBattleUnit()];
    expect(getMult(board, 1)).toBe(1);
  });

  it("returns 2 when right neighbor is brains", () => {
    const board = [makeBattleUnit(), makeBattleUnit({ id: "brains" })];
    expect(getMult(board, 0)).toBe(2);
  });

  it("returns 1 when no adjacent brains", () => {
    const board = [makeBattleUnit(), makeBattleUnit(), makeBattleUnit()];
    expect(getMult(board, 1)).toBe(1);
  });

  it("returns 1 for first index with no left neighbor", () => {
    const board = [makeBattleUnit(), makeBattleUnit()];
    expect(getMult(board, 0)).toBe(1);
  });

  it("returns 1 for last index with no right neighbor", () => {
    const board = [makeBattleUnit(), makeBattleUnit()];
    expect(getMult(board, 1)).toBe(1);
  });

  it("handles brains on both sides", () => {
    const board = [
      makeBattleUnit({ id: "brains" }),
      makeBattleUnit(),
      makeBattleUnit({ id: "brains" }),
    ];
    expect(getMult(board, 1)).toBe(2);
  });
});

describe("createToken", () => {
  it("creates a token with correct stats", () => {
    const token = createToken("巨大蛆虫", 1, 1);
    expect(token.name).toBe("巨大蛆虫");
    expect(token.atk).toBe(1);
    expect(token.hp).toBe(1);
    expect(token.baseAtk).toBe(1);
    expect(token.baseHp).toBe(1);
  });

  it("sets id to 'token'", () => {
    const token = createToken("test", 3, 5);
    expect(token.id).toBe("token");
  });

  it("sets default properties correctly", () => {
    const token = createToken("test", 1, 1);
    expect(token.equip).toBeNull();
    expect(token.level).toBe(1);
    expect(token.tier).toBe(1);
    expect(token.exp).toBe(0);
    expect(token.isChurch).toBe(false);
  });

  it("sets isChurch when specified", () => {
    const token = createToken("祝福された幼子", 2, 2, true);
    expect(token.isChurch).toBe(true);
  });

  it("generates a unique uid", () => {
    const token1 = createToken("a", 1, 1);
    const token2 = createToken("b", 1, 1);
    expect(token1.uid).not.toBe(token2.uid);
  });
});

describe("pushFrame", () => {
  it("sets opLimitExceeded when opCount exceeds MAX_OPS", () => {
    const ctx = makeContext();
    ctx.opCount = MAX_OPS;
    pushFrame(ctx, "info", ["test"], "info");
    expect(ctx.opLimitExceeded).toBe(true);
    expect(ctx.frames).toHaveLength(0);
  });

  it("adds frame normally at opCount = MAX_OPS - 1", () => {
    const ctx = makeContext();
    ctx.opCount = MAX_OPS - 1;
    pushFrame(ctx, "info", ["boundary test"], "info");
    expect(ctx.opLimitExceeded).toBe(false);
    expect(ctx.frames).toHaveLength(1);
    expect(segmentsToPlainText(ctx.frames[0]!.log.segments)).toBe("boundary test");
  });
});
