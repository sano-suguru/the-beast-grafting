import { processAvenge, incrementAvengeCounters } from "./battle-avenge";
import { makeBattleUnit, makeContext, INERT_UNIT_ID } from "./test-helpers";
import {
  atLevel,
  CHARNEL_PIT,
  GRINNING_SKULL,
  ARCHANGEL,
  GROANING_COFFIN,
  WAILING_CURSECHILD,
} from "../shared/skill-params";

describe("processAvenge – charnel_pit (independent counters)", () => {
  it("spawns token when counter reaches threshold", () => {
    const pit = makeBattleUnit({
      id: "charnel_pit",
      name: "肉溜",
      atk: 0,
      hp: 6,
      avengeDeathCount: 2,
      skillUses: 1,
    });
    const board = [pit];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    expect(pit.avengeDeathCount).toBe(0);
    expect(board.length).toBe(2);
    const token = board.find((u) => u.name === "肉塊");
    expect(token).toBeDefined();
    const t = atLevel(CHARNEL_PIT.token, 1);
    expect(token!.atk).toBe(t.atk);
    expect(token!.hp).toBe(t.hp);
  });

  it("spawns multiple tokens when counter is 2x threshold", () => {
    const pit = makeBattleUnit({
      id: "charnel_pit",
      name: "肉溜",
      atk: 0,
      hp: 6,
      avengeDeathCount: 4,
      skillUses: 2,
    });
    const board = [pit];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    expect(pit.avengeDeathCount).toBe(0);
    const tokens = board.filter((u) => u.name === "肉塊");
    expect(tokens.length).toBe(2);
  });

  it("keeps leftover count below threshold", () => {
    const pit = makeBattleUnit({
      id: "charnel_pit",
      name: "肉溜",
      atk: 0,
      hp: 6,
      avengeDeathCount: 3,
      skillUses: 1,
    });
    const board = [pit];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    expect(pit.avengeDeathCount).toBe(1);
    expect(board.filter((u) => u.name === "肉塊").length).toBe(1);
  });

  it("both charnel_pits trigger independently", () => {
    const pit1 = makeBattleUnit({
      id: "charnel_pit",
      name: "肉溜1",
      atk: 0,
      hp: 6,
      avengeDeathCount: 2,
      skillUses: 1,
    });
    const pit2 = makeBattleUnit({
      id: "charnel_pit",
      name: "肉溜2",
      atk: 0,
      hp: 6,
      avengeDeathCount: 2,
      skillUses: 1,
    });
    const board = [pit1, pit2];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    const tokens = board.filter((u) => u.name === "肉塊");
    expect(tokens.length).toBe(2);
    expect(pit1.avengeDeathCount).toBe(0);
    expect(pit2.avengeDeathCount).toBe(0);
  });

  it("stops spawning after skillUses exhausted", () => {
    const pit = makeBattleUnit({
      id: "charnel_pit",
      name: "肉溜",
      atk: 0,
      hp: 6,
      avengeDeathCount: 4,
      skillUses: 1,
    });
    const board = [pit];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    // skillUses=1 → 1回スポーン後stop。avengeDeathCount 4で閾値2×2回到達するがusesが足りない
    expect(board.filter((u) => u.name === "肉塊").length).toBe(1);
    expect(pit.skillUses).toBe(0);
    expect(pit.avengeDeathCount).toBe(0);
  });
});

describe("processAvenge – grinning_skull (independent counters)", () => {
  it("buffs all allies when counter reaches threshold", () => {
    const rel = makeBattleUnit({
      id: "grinning_skull",
      name: "聖骨箱",
      atk: 2,
      hp: 8,
      avengeDeathCount: 3,
    });
    const ally = makeBattleUnit({ atk: 3, hp: 5 });
    const board = [rel, ally];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    expect(rel.avengeDeathCount).toBe(0);
    const b = atLevel(GRINNING_SKULL.buff, 1);
    expect(rel.atk).toBe(2 + b.atk);
    expect(ally.atk).toBe(3 + b.atk);
    expect(ally.hp).toBe(5 + b.hp);
  });

  it("does not trigger below threshold", () => {
    const rel = makeBattleUnit({
      id: "grinning_skull",
      name: "聖骨箱",
      atk: 2,
      hp: 8,
      avengeDeathCount: 2,
    });
    const board = [rel];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    expect(rel.avengeDeathCount).toBe(2);
    expect(ctx.frames).toHaveLength(0);
  });

  it("triggers twice with 6 deaths accumulated", () => {
    const rel = makeBattleUnit({
      id: "grinning_skull",
      name: "聖骨箱",
      atk: 2,
      hp: 8,
      avengeDeathCount: 6,
    });
    const board = [rel];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    const b = atLevel(GRINNING_SKULL.buff, 1);
    expect(rel.atk).toBe(2 + b.atk * 2);
    expect(rel.avengeDeathCount).toBe(0);
  });
});

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
  it("increments only avenge units, not others", () => {
    const pit = makeBattleUnit({ id: "charnel_pit", hp: 6 });
    const rel = makeBattleUnit({ id: "grinning_skull", hp: 8 });
    const other = makeBattleUnit({ id: "rat", hp: 3 });
    const board = [pit, rel, other];
    incrementAvengeCounters(board);
    expect(pit.avengeDeathCount).toBe(1);
    expect(rel.avengeDeathCount).toBe(1);
    expect(other.avengeDeathCount).toBe(0);
  });

  it("does not increment dead avenge units", () => {
    const pit = makeBattleUnit({ id: "charnel_pit", hp: 0 });
    const board = [pit];
    incrementAvengeCounters(board);
    expect(pit.avengeDeathCount).toBe(0);
  });

  it("charnel_pit and grinning_skull trigger independently on same death count", () => {
    const pit = makeBattleUnit({
      id: "charnel_pit",
      atk: 0,
      hp: 6,
      avengeDeathCount: 1,
      skillUses: 1,
    });
    const rel = makeBattleUnit({ id: "grinning_skull", atk: 2, hp: 8, avengeDeathCount: 2 });
    const board = [pit, rel];
    const ctx = makeContext(board, []);
    // Simulate 1 more death → pit reaches 2 (threshold), rel reaches 3 (threshold)
    incrementAvengeCounters(board);
    processAvenge(board, true, ctx);
    expect(pit.avengeDeathCount).toBe(0);
    expect(rel.avengeDeathCount).toBe(0);
    // Both triggered
    expect(board.filter((u) => u.name === "肉塊").length).toBe(1);
    const b = atLevel(GRINNING_SKULL.buff, 1);
    expect(rel.atk).toBe(2 + b.atk);
  });
});

describe("processAvenge snapshot – spawn does not skip later avenge units", () => {
  it("CharnelPit spawn does not skip GrinningSkull", () => {
    const pit = makeBattleUnit({
      id: "charnel_pit",
      name: "肉溜",
      atk: 0,
      hp: 6,
      avengeDeathCount: 2,
      skillUses: 1,
    });
    const skull = makeBattleUnit({
      id: "grinning_skull",
      name: "聖骨箱",
      atk: 2,
      hp: 8,
      avengeDeathCount: 3,
    });
    const board = [pit, skull];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    // Both should trigger
    expect(pit.avengeDeathCount).toBe(0);
    expect(skull.avengeDeathCount).toBe(0);
    expect(board.filter((u) => u.name === "肉塊")).toHaveLength(1);
    const b = atLevel(GRINNING_SKULL.buff, 1);
    expect(skull.atk).toBe(2 + b.atk);
  });
});

describe("processAvenge – groaning_coffin", () => {
  it("deals damage to random enemy when threshold reached", () => {
    const coffin = makeBattleUnit({
      id: "groaning_coffin",
      name: "唸る棺",
      atk: 2,
      hp: 5,
      avengeDeathCount: 2,
    });
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, hp: 10 });
    const board = [coffin];
    const ctx = makeContext(board, [enemy]);
    processAvenge(board, true, ctx);
    const dmg = atLevel(GROANING_COFFIN.damage, 1);
    expect(enemy.hp).toBe(10 - dmg);
    expect(coffin.avengeDeathCount).toBe(0);
    expect(ctx.frames).toHaveLength(1);
  });

  it("does not trigger below threshold", () => {
    const coffin = makeBattleUnit({
      id: "groaning_coffin",
      name: "唸る棺",
      atk: 2,
      hp: 5,
      avengeDeathCount: 1,
    });
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, hp: 10 });
    const board = [coffin];
    const ctx = makeContext(board, [enemy]);
    processAvenge(board, true, ctx);
    expect(enemy.hp).toBe(10);
    expect(ctx.frames).toHaveLength(0);
  });
});

describe("processAvenge – wailing_cursechild", () => {
  it("buffs all allies when threshold reached", () => {
    const child = makeBattleUnit({
      id: "wailing_cursechild",
      name: "啼き喚く呪い児",
      atk: 3,
      hp: 7,
      avengeDeathCount: 3,
      skillUses: 1,
    });
    const ally = makeBattleUnit({ id: INERT_UNIT_ID, atk: 2, hp: 3 });
    const board = [child, ally];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    const b = atLevel(WAILING_CURSECHILD.buff, 1);
    expect(child.atk).toBe(3 + b.atk);
    expect(child.hp).toBe(7 + b.hp);
    expect(ally.atk).toBe(2 + b.atk);
    expect(ally.hp).toBe(3 + b.hp);
    expect(child.avengeDeathCount).toBe(0);
  });

  it("stops buffing after skillUses exhausted", () => {
    const child = makeBattleUnit({
      id: "wailing_cursechild",
      name: "啼き喚く呪い児",
      atk: 3,
      hp: 20,
      avengeDeathCount: 6,
      skillUses: 1,
    });
    const ally = makeBattleUnit({ id: INERT_UNIT_ID, atk: 2, hp: 3 });
    const board = [child, ally];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    const b = atLevel(WAILING_CURSECHILD.buff, 1);
    // skillUses=1 → 1回分のバフのみ（threshold 3を2回分消費しても1回だけ発動）
    expect(child.atk).toBe(3 + b.atk);
    expect(ally.atk).toBe(2 + b.atk);
    expect(child.skillUses).toBe(0);
  });
});
