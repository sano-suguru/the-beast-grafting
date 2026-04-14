import { computeZealotBuff } from "./buff-utils";
import { makeBattleUnit } from "./test-helpers";

describe("computeZealotBuff", () => {
  it("returns sum of multipliers for zealots on board", () => {
    const board = [
      makeBattleUnit({ id: "zealot", hp: 3 }),
      makeBattleUnit({ id: "zealot", hp: 5 }),
      makeBattleUnit({ id: "rat", hp: 2 }),
    ];
    const result = computeZealotBuff(board, {
      requireAlive: true,
      getMultiplier: (i) => i + 1,
    });
    // zealot at idx 0 → buff 1 × mult 1 = 1, zealot at idx 1 → buff 1 × mult 2 = 2
    expect(result).toBe(3);
  });

  it("returns sum of buff values when no getMultiplier provided", () => {
    const board = [
      makeBattleUnit({ id: "zealot", hp: 3 }),
      makeBattleUnit({ id: "zealot", hp: 5 }),
    ];
    const result = computeZealotBuff(board, { requireAlive: true });
    expect(result).toBe(2);
  });

  it("returns 0 when no zealots on board", () => {
    const board = [makeBattleUnit({ id: "rat", hp: 2 })];
    const result = computeZealotBuff(board, { requireAlive: true });
    expect(result).toBe(0);
  });

  it("Lv2 zealot gives buff of 2", () => {
    const board = [makeBattleUnit({ id: "zealot", hp: 3, level: 2 })];
    const result = computeZealotBuff(board, { requireAlive: true });
    expect(result).toBe(2);
  });

  it("Lv2 zealot with multiplier gives buff × multiplier", () => {
    const board = [makeBattleUnit({ id: "zealot", hp: 3, level: 2 })];
    const result = computeZealotBuff(board, {
      requireAlive: true,
      getMultiplier: () => 2,
    });
    expect(result).toBe(4);
  });

  it("skips dead zealots when requireAlive is true", () => {
    const board = [
      makeBattleUnit({ id: "zealot", hp: 0 }),
      makeBattleUnit({ id: "zealot", hp: 3 }),
    ];
    const result = computeZealotBuff(board, { requireAlive: true });
    expect(result).toBe(1);
  });
});
