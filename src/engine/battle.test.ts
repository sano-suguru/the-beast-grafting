import { simulateBattle, runBattle } from "./battle";
import { makeUnit, makeBattleUnit, makeEnemyTeam, makeContext } from "./test-helpers";
import { MAX_OPS } from "./constants";
import type { BattleFrame } from "../shared/types";
import { segmentsToPlainText } from "./test-helpers";

const logText = (f: BattleFrame) => segmentsToPlainText(f.log.segments);

const SEED = 42;

describe("simulateBattle", () => {
  it("returns WIN when player units are stronger", () => {
    const playerBoard = [makeUnit({ baseAtk: 10, baseHp: 20 }), null, null, null, null];
    const enemy = makeEnemyTeam([makeUnit({ baseAtk: 1, baseHp: 1 })]);
    const { result } = simulateBattle(playerBoard, enemy, 1, SEED);
    expect(result).toBe("WIN");
  });

  it("returns LOSE when enemy units are stronger", () => {
    const playerBoard = [makeUnit({ baseAtk: 1, baseHp: 1 }), null, null, null, null];
    const enemy = makeEnemyTeam([makeUnit({ baseAtk: 10, baseHp: 20 })]);
    const { result } = simulateBattle(playerBoard, enemy, 1, SEED);
    expect(result).toBe("LOSE");
  });

  it("returns DRAW when both sides die simultaneously", () => {
    const playerBoard = [makeUnit({ baseAtk: 5, baseHp: 5 }), null, null, null, null];
    const enemy = makeEnemyTeam([makeUnit({ baseAtk: 5, baseHp: 5 })]);
    const { result } = simulateBattle(playerBoard, enemy, 1, SEED);
    expect(result).toBe("DRAW");
  });

  it("generates frames including info and result", () => {
    const playerBoard = [makeUnit({ baseAtk: 10, baseHp: 10 }), null, null, null, null];
    const enemy = makeEnemyTeam([makeUnit({ baseAtk: 1, baseHp: 1 })]);
    const { frames } = simulateBattle(playerBoard, enemy, 1, SEED);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames[0]!.log.type).toBe("info");
    expect(frames[frames.length - 1]!.log.type).toBe("result");
  });

  it("handles multiple units on both sides", () => {
    const playerBoard = [
      makeUnit({ baseAtk: 5, baseHp: 5 }),
      makeUnit({ baseAtk: 5, baseHp: 5 }),
      null,
      null,
      null,
    ];
    const enemy = makeEnemyTeam([
      makeUnit({ baseAtk: 2, baseHp: 2 }),
      makeUnit({ baseAtk: 2, baseHp: 2 }),
    ]);
    const { result } = simulateBattle(playerBoard, enemy, 1, SEED);
    expect(result).toBe("WIN");
  });

  it("handles empty player board gracefully", () => {
    const playerBoard = [null, null, null, null, null];
    const enemy = makeEnemyTeam([makeUnit({ baseAtk: 1, baseHp: 1 })]);
    const { result } = simulateBattle(playerBoard, enemy, 1, SEED);
    expect(result).toBe("LOSE");
  });

  it("does not mutate enemyTeam.units", () => {
    const u1 = makeUnit({ baseAtk: 1, baseHp: 1, uid: "e1" });
    const u2 = makeUnit({ baseAtk: 2, baseHp: 2, uid: "e2" });
    const enemy = makeEnemyTeam([u1, u2]);
    const originalOrder = [...enemy.units];
    simulateBattle([makeUnit({ baseAtk: 10, baseHp: 10 }), null, null, null, null], enemy, 1, SEED);
    expect(enemy.units.map((u) => u.uid)).toEqual(originalOrder.map((u) => u.uid));
  });

  it("returns DRAW and timeout frame when combat round limit is reached", () => {
    const ctx = makeContext(
      [makeBattleUnit({ atk: 1, hp: 99999, baseAtk: 1, baseHp: 99999 })],
      [makeBattleUnit({ atk: 1, hp: 99999, baseAtk: 1, baseHp: 99999 })],
    );
    const enemy = makeEnemyTeam([makeUnit({ baseAtk: 1, baseHp: 99999 })]);
    const { result, frames } = runBattle(ctx, enemy, 1);
    expect(result).toBe("DRAW");
    expect(frames.some((f) => logText(f).includes("戦闘が長引きすぎた"))).toBe(true);
  });

  it("returns DRAW when op limit is exceeded", () => {
    const ctx = makeContext(
      [makeBattleUnit({ atk: 1, hp: 999, baseAtk: 1, baseHp: 999 })],
      [makeBattleUnit({ atk: 1, hp: 999, baseAtk: 1, baseHp: 999 })],
    );
    ctx.opCount = MAX_OPS - 10;
    const enemy = makeEnemyTeam([makeUnit({ baseAtk: 1, baseHp: 999 })]);
    const { result } = runBattle(ctx, enemy, 1);
    expect(result).toBe("DRAW");
    expect(ctx.opLimitExceeded).toBe(true);
  });
});
