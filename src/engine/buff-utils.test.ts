import { computeZealotBuff } from "./buff-utils";
import { makeBattleUnit } from "./test-helpers";

describe("computeZealotBuff", () => {
  it("sums base buff values across zealots", () => {
    const board = [
      makeBattleUnit({ id: "zealot", hp: 3 }),
      makeBattleUnit({ id: "zealot", hp: 5 }),
      makeBattleUnit({ id: "rat", hp: 2 }),
    ];
    const result = computeZealotBuff(board, { requireAlive: true });
    expect(result).toBe(2);
  });

  it("adds repeat-level buff when getRepeatLevel returns a level (brains再発動)", () => {
    const board = [makeBattleUnit({ id: "zealot", hp: 3, level: 1 })];
    // lv1 buff=1, lv2 buff=2 → 合計 3
    const result = computeZealotBuff(board, {
      requireAlive: true,
      getRepeatLevel: () => 2,
    });
    expect(result).toBe(3);
  });

  it("does not add repeat contribution when getRepeatLevel returns null", () => {
    const board = [makeBattleUnit({ id: "zealot", hp: 3, level: 1 })];
    const result = computeZealotBuff(board, {
      requireAlive: true,
      getRepeatLevel: () => null,
    });
    expect(result).toBe(1);
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

  it("skips dead zealots when requireAlive is true", () => {
    const board = [
      makeBattleUnit({ id: "zealot", hp: 0 }),
      makeBattleUnit({ id: "zealot", hp: 3 }),
    ];
    const result = computeZealotBuff(board, { requireAlive: true });
    expect(result).toBe(1);
  });
});
