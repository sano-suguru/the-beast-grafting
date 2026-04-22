import { processAvenge, incrementAvengeCounters, processWolverine } from "./battle-avenge";
import { makeBattleUnit, makeContext } from "./test-helpers";
import { atLevel, ARCHANGEL, GRINNING_SKULL } from "../shared/skill-params";

describe("processAvenge – archangel (independent counters)", () => {
  it("buffs self when counter reaches threshold", () => {
    const arch = makeBattleUnit({
      id: "archangel",
      name: "大天使",
      atk: 6,
      hp: 8,
      avengeDeathCount: 2,
    });
    const board = [arch];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    expect(arch.avengeDeathCount).toBe(0);
    const b = atLevel(ARCHANGEL.buff, 1);
    expect(arch.atk).toBe(6 + b.atk);
    expect(arch.hp).toBe(8 + b.hp);
  });

  it("does not trigger below threshold", () => {
    const arch = makeBattleUnit({
      id: "archangel",
      name: "大天使",
      atk: 6,
      hp: 8,
      avengeDeathCount: 1,
    });
    const board = [arch];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    expect(arch.avengeDeathCount).toBe(1);
    expect(ctx.frames).toHaveLength(0);
  });

  it("triggers twice with 4 deaths accumulated", () => {
    const arch = makeBattleUnit({
      id: "archangel",
      name: "大天使",
      atk: 6,
      hp: 8,
      avengeDeathCount: 4,
    });
    const board = [arch];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    const b = atLevel(ARCHANGEL.buff, 1);
    expect(arch.atk).toBe(6 + b.atk * 2);
    expect(arch.hp).toBe(8 + b.hp * 2);
  });
});

describe("incrementAvengeCounters – independent per-unit", () => {
  it("increments only avenge units (archangel), not others", () => {
    const arch = makeBattleUnit({ id: "archangel", hp: 8 });
    const rel = makeBattleUnit({ id: "grinning_skull", hp: 8 });
    const other = makeBattleUnit({ id: "rat", hp: 3 });
    const board = [arch, rel, other];
    incrementAvengeCounters(board);
    expect(arch.avengeDeathCount).toBe(1);
    // grinning_skull no longer uses avenge counter (Wolverine = hurt-based)
    expect(rel.avengeDeathCount).toBe(0);
    expect(other.avengeDeathCount).toBe(0);
  });

  it("does not increment dead avenge units", () => {
    const arch = makeBattleUnit({ id: "archangel", hp: 0 });
    const board = [arch];
    incrementAvengeCounters(board);
    expect(arch.avengeDeathCount).toBe(0);
  });
});

describe("processWolverine – grinning_skull hurt counter", () => {
  it("reduces all enemies HP when threshold reached", () => {
    const wolv = makeBattleUnit({ id: "grinning_skull", name: "嗤う髑髏", atk: 5, hp: 7 });
    const ally = makeBattleUnit({ atk: 3, hp: 5 });
    const pBoard = [wolv, ally];
    const e1 = makeBattleUnit({ atk: 2, hp: 10, side: "e" });
    const e2 = makeBattleUnit({ atk: 2, hp: 10, side: "e" });
    const eBoard = [e1, e2];
    const ctx = makeContext(pBoard, eBoard);
    ctx.pHurtThisTick = 4;
    processWolverine(pBoard, true, ctx);
    const cut = atLevel(GRINNING_SKULL.hpReduction, 1);
    expect(e1.hp).toBe(10 - cut);
    expect(e2.hp).toBe(10 - cut);
    expect(wolv.hurtCount).toBe(0);
    expect(ctx.pHurtThisTick).toBe(0);
  });

  it("accumulates hurt counts below threshold without firing", () => {
    const wolv = makeBattleUnit({ id: "grinning_skull", atk: 5, hp: 7 });
    const ally = makeBattleUnit({ atk: 3, hp: 5 });
    const pBoard = [wolv, ally];
    const enemy = makeBattleUnit({ atk: 2, hp: 10, side: "e" });
    const eBoard = [enemy];
    const ctx = makeContext(pBoard, eBoard);
    ctx.pHurtThisTick = 2;
    processWolverine(pBoard, true, ctx);
    expect(enemy.hp).toBe(10);
    expect(wolv.hurtCount).toBe(2);
  });

  it("HP reduction floors at 1 (never lethal)", () => {
    const wolv = makeBattleUnit({ id: "grinning_skull", atk: 5, hp: 7, level: 3 });
    const ally = makeBattleUnit({ atk: 3, hp: 5 });
    const pBoard = [wolv, ally];
    const e1 = makeBattleUnit({ atk: 2, hp: 2, side: "e" });
    const eBoard = [e1];
    const ctx = makeContext(pBoard, eBoard);
    ctx.pHurtThisTick = 4;
    processWolverine(pBoard, true, ctx);
    expect(e1.hp).toBe(1);
  });

  it("counts hurt from units that died this tick (board除去後も計上)", () => {
    // 味方が死亡で盤面から消えても被弾は ctx.pHurtThisTick に累積されているので Wolverine がカウントする
    const wolv = makeBattleUnit({ id: "grinning_skull", atk: 5, hp: 7 });
    const pBoard = [wolv]; // 4体分被弾したが resolveDeaths で全員除去されたと想定
    const enemy = makeBattleUnit({ atk: 2, hp: 10, side: "e" });
    const eBoard = [enemy];
    const ctx = makeContext(pBoard, eBoard);
    ctx.pHurtThisTick = 4;
    processWolverine(pBoard, true, ctx);
    const cut = atLevel(GRINNING_SKULL.hpReduction, 1);
    expect(enemy.hp).toBe(10 - cut);
    expect(wolv.hurtCount).toBe(0);
  });

  it("only consumes its own side's hurt counter", () => {
    // processWolverine(pBoard) は pHurtThisTick のみ消費し、eHurtThisTick は残す
    const wolv = makeBattleUnit({ id: "grinning_skull", atk: 5, hp: 7 });
    const pBoard = [wolv];
    const enemy = makeBattleUnit({ atk: 2, hp: 10, side: "e" });
    const eBoard = [enemy];
    const ctx = makeContext(pBoard, eBoard);
    ctx.pHurtThisTick = 2;
    ctx.eHurtThisTick = 3;
    processWolverine(pBoard, true, ctx);
    expect(ctx.pHurtThisTick).toBe(0);
    expect(ctx.eHurtThisTick).toBe(3);
  });
});
