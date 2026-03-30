import { simulateBattle, runBattle } from "./battle";
import { makeUnit, makeBattleUnit, makeEnemyTeam, makeContext } from "./test-helpers";
import { MAX_OPS } from "./constants";

describe("simulateBattle", () => {
  it("returns WIN when player units are stronger", () => {
    const playerBoard = [makeUnit({ atk: 10, hp: 20 }), null, null, null, null];
    const enemy = makeEnemyTeam([makeUnit({ atk: 1, hp: 1 })]);
    const { result } = simulateBattle(playerBoard, enemy, 1);
    expect(result).toBe("WIN");
  });

  it("returns LOSE when enemy units are stronger", () => {
    const playerBoard = [makeUnit({ atk: 1, hp: 1 }), null, null, null, null];
    const enemy = makeEnemyTeam([makeUnit({ atk: 10, hp: 20 })]);
    const { result } = simulateBattle(playerBoard, enemy, 1);
    expect(result).toBe("LOSE");
  });

  it("returns DRAW when both sides die simultaneously", () => {
    const playerBoard = [makeUnit({ atk: 5, hp: 5 }), null, null, null, null];
    const enemy = makeEnemyTeam([makeUnit({ atk: 5, hp: 5 })]);
    const { result } = simulateBattle(playerBoard, enemy, 1);
    expect(result).toBe("DRAW");
  });

  it("generates frames including info and result", () => {
    const playerBoard = [makeUnit({ atk: 10, hp: 10 }), null, null, null, null];
    const enemy = makeEnemyTeam([makeUnit({ atk: 1, hp: 1 })]);
    const { frames } = simulateBattle(playerBoard, enemy, 1);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames[0]!.log.type).toBe("info");
    expect(frames[frames.length - 1]!.log.type).toBe("result");
  });

  it("handles multiple units on both sides", () => {
    const playerBoard = [
      makeUnit({ atk: 5, hp: 5 }),
      makeUnit({ atk: 5, hp: 5 }),
      null,
      null,
      null,
    ];
    const enemy = makeEnemyTeam([makeUnit({ atk: 2, hp: 2 }), makeUnit({ atk: 2, hp: 2 })]);
    const { result } = simulateBattle(playerBoard, enemy, 1);
    expect(result).toBe("WIN");
  });

  it("handles empty player board gracefully", () => {
    const playerBoard = [null, null, null, null, null];
    const enemy = makeEnemyTeam([makeUnit({ atk: 1, hp: 1 })]);
    const { result } = simulateBattle(playerBoard, enemy, 1);
    expect(result).toBe("LOSE");
  });

  it("does not mutate enemyTeam.units", () => {
    const u1 = makeUnit({ atk: 1, hp: 1, uid: "e1" });
    const u2 = makeUnit({ atk: 2, hp: 2, uid: "e2" });
    const enemy = makeEnemyTeam([u1, u2]);
    const originalOrder = [...enemy.units];
    simulateBattle([makeUnit({ atk: 10, hp: 10 }), null, null, null, null], enemy, 1);
    expect(enemy.units.map((u) => u.uid)).toEqual(originalOrder.map((u) => u.uid));
  });

  it("returns DRAW and timeout frame when combat round limit is reached", () => {
    const ctx = makeContext(
      [makeBattleUnit({ atk: 1, hp: 99999 })],
      [makeBattleUnit({ atk: 1, hp: 99999 })],
    );
    const enemy = makeEnemyTeam([makeUnit({ atk: 1, hp: 99999 })]);
    const { result, frames } = runBattle(ctx, enemy, 1);
    expect(result).toBe("DRAW");
    expect(frames.some((f) => f.log.text.includes("戦闘が長引きすぎた"))).toBe(true);
  });

  it("returns DRAW when op limit is exceeded", () => {
    const ctx = makeContext(
      [makeBattleUnit({ atk: 1, hp: 999 })],
      [makeBattleUnit({ atk: 1, hp: 999 })],
    );
    ctx.opCount = MAX_OPS - 10;
    const enemy = makeEnemyTeam([makeUnit({ atk: 1, hp: 999 })]);
    const { result } = runBattle(ctx, enemy, 1);
    expect(result).toBe("DRAW");
    expect(ctx.opLimitExceeded).toBe(true);
  });
});
