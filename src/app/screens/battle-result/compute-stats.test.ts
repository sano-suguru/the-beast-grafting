import { computeBattleStats } from "./compute-stats";
import type { BattleFrame } from "../../../shared/types";
import { makeSnapshot } from "../../../engine/test-helpers";

function frame(overrides: Partial<BattleFrame> = {}): BattleFrame {
  return {
    pBoard: [],
    eBoard: [],
    log: { id: "1", type: "info", segments: ["test"], icon: "info" },
    actions: {},
    ...overrides,
  };
}

describe("computeBattleStats", () => {
  it("returns empty stats for empty frames", () => {
    const result = computeBattleStats([]);
    expect(result.playerUnits).toEqual([]);
    expect(result.enemyUnits).toEqual([]);
  });

  it("computes damage dealt from source field", () => {
    const p = makeSnapshot({ uid: "p1", name: "腐鼠", hp: 5 });
    const e = makeSnapshot({ uid: "e1", name: "教団兵", hp: 6 });

    const frames: BattleFrame[] = [
      frame({ pBoard: [p], eBoard: [e] }),
      frame({
        pBoard: [{ ...p, hp: 2 }],
        eBoard: [{ ...e, hp: 1 }],
        actions: {
          p1: { type: "damage", value: "-3", source: "e1", damage: 3 },
          e1: { type: "damage", value: "-5", source: "p1", damage: 5 },
        },
      }),
    ];

    const stats = computeBattleStats(frames);
    expect(stats.playerUnits).toHaveLength(1);
    expect(stats.playerUnits[0]!.damageDealt).toBe(5);
    expect(stats.playerUnits[0]!.finalHp).toBe(2);
    expect(stats.playerUnits[0]!.alive).toBe(true);

    expect(stats.enemyUnits[0]!.damageDealt).toBe(3);
    expect(stats.enemyUnits[0]!.finalHp).toBe(1);
  });

  it("marks dead units correctly", () => {
    const p = makeSnapshot({ uid: "p1", hp: 5 });
    const e = makeSnapshot({ uid: "e1", hp: 3 });

    const frames: BattleFrame[] = [
      frame({ pBoard: [p], eBoard: [e] }),
      frame({
        pBoard: [p],
        eBoard: [],
        actions: { e1: { type: "death" } },
      }),
    ];

    const stats = computeBattleStats(frames);
    expect(stats.enemyUnits[0]!.alive).toBe(false);
    expect(stats.enemyUnits[0]!.finalHp).toBe(0);
    expect(stats.playerUnits[0]!.alive).toBe(true);
  });

  it("accumulates damage across multiple frames", () => {
    const p = makeSnapshot({ uid: "p1", hp: 10 });
    const e = makeSnapshot({ uid: "e1", hp: 10 });

    const frames: BattleFrame[] = [
      frame({ pBoard: [p], eBoard: [e] }),
      frame({
        pBoard: [{ ...p, hp: 7 }],
        eBoard: [{ ...e, hp: 6 }],
        actions: {
          p1: { type: "damage", value: "-3", source: "e1", damage: 3 },
          e1: { type: "damage", value: "-4", source: "p1", damage: 4 },
        },
      }),
      frame({
        pBoard: [{ ...p, hp: 5 }],
        eBoard: [{ ...e, hp: 0 }],
        actions: {
          p1: { type: "damage", value: "-2", source: "e1", damage: 2 },
          e1: { type: "damage", value: "-6", source: "p1", damage: 6 },
        },
      }),
    ];

    const stats = computeBattleStats(frames);
    expect(stats.playerUnits[0]!.damageDealt).toBe(10);
    expect(stats.enemyUnits[0]!.damageDealt).toBe(5);
  });

  it("ignores non-numeric damage values", () => {
    const p = makeSnapshot({ uid: "p1", hp: 5 });
    const e = makeSnapshot({ uid: "e1", hp: 5 });

    const frames: BattleFrame[] = [
      frame({ pBoard: [p], eBoard: [e] }),
      frame({
        pBoard: [p],
        eBoard: [e],
        actions: { e1: { type: "damage", value: "装備消去" } },
      }),
    ];

    const stats = computeBattleStats(frames);
    expect(stats.playerUnits[0]!.damageDealt).toBe(0);
    expect(stats.enemyUnits[0]!.damageDealt).toBe(0);
  });

  it("counts defended damage toward the attacker's total", () => {
    const p = makeSnapshot({ uid: "p1", name: "腐鼠", hp: 5 });
    const e = makeSnapshot({ uid: "e1", name: "教団兵", hp: 8 });

    const frames: BattleFrame[] = [
      frame({ pBoard: [p], eBoard: [e] }),
      frame({
        pBoard: [{ ...p, hp: 2 }],
        eBoard: [{ ...e, hp: 5 }],
        actions: {
          p1: { type: "defend", value: "-3", source: "e1", damage: 3 },
          e1: { type: "defend", value: "-3", source: "p1", damage: 3 },
        },
      }),
    ];

    const stats = computeBattleStats(frames);
    expect(stats.playerUnits[0]!.damageDealt).toBe(3);
    expect(stats.enemyUnits[0]!.damageDealt).toBe(3);
  });

  it("accumulates damage across damage and defend action types", () => {
    const p = makeSnapshot({ uid: "p1", name: "腐鼠", hp: 10 });
    const e = makeSnapshot({ uid: "e1", name: "教団兵", hp: 10 });

    const frames: BattleFrame[] = [
      frame({ pBoard: [p], eBoard: [e] }),
      frame({
        pBoard: [{ ...p, hp: 7 }],
        eBoard: [{ ...e, hp: 6 }],
        actions: {
          p1: { type: "damage", value: "-3", source: "e1", damage: 3 },
          e1: { type: "damage", value: "-4", source: "p1", damage: 4 },
        },
      }),
      frame({
        pBoard: [{ ...p, hp: 5 }],
        eBoard: [{ ...e, hp: 4 }],
        actions: {
          p1: { type: "defend", value: "-2", source: "e1", damage: 2 },
          e1: { type: "defend", value: "-2", source: "p1", damage: 2 },
        },
      }),
    ];

    const stats = computeBattleStats(frames);
    expect(stats.playerUnits[0]!.damageDealt).toBe(6);
    expect(stats.enemyUnits[0]!.damageDealt).toBe(5);
  });

  it("uses maxHp from initial frame", () => {
    const p = makeSnapshot({ uid: "p1", hp: 8 });

    const frames: BattleFrame[] = [
      frame({ pBoard: [p], eBoard: [] }),
      frame({ pBoard: [{ ...p, hp: 3 }], eBoard: [] }),
    ];

    const stats = computeBattleStats(frames);
    expect(stats.playerUnits[0]!.maxHp).toBe(8);
    expect(stats.playerUnits[0]!.finalHp).toBe(3);
  });
});
