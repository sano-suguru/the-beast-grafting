import { spawnTokenAndNotify } from "./battle-spawn";
import { makeBattleUnit, makeContext } from "./test-helpers";
import { MAX_BOARD_SIZE } from "./constants";

describe("spawnTokenAndNotify – board size guard", () => {
  it("returns null and does not grow board when at MAX_BOARD_SIZE", () => {
    const units = Array.from({ length: MAX_BOARD_SIZE }, () => makeBattleUnit({ hp: 5 }));
    const ctx = makeContext(units, []);
    const result = spawnTokenAndNotify({
      board: units,
      idx: 0,
      name: "test",
      atk: 1,
      hp: 1,
      isChurch: false,
      segments: () => [],
      isPlayer: true,
      ctx,
    });
    expect(result).toBeNull();
    expect(units).toHaveLength(MAX_BOARD_SIZE);
  });

  it("spawns when board has room", () => {
    const units = [makeBattleUnit({ hp: 5 })];
    const ctx = makeContext(units, []);
    const result = spawnTokenAndNotify({
      board: units,
      idx: 0,
      name: "test",
      atk: 1,
      hp: 1,
      isChurch: false,
      segments: () => [],
      isPlayer: true,
      ctx,
    });
    expect(result).not.toBeNull();
    expect(units).toHaveLength(2);
  });
});
