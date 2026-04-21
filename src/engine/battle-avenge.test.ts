import { processAvenge, incrementAvengeCounters } from "./battle-avenge";
import { makeBattleUnit, makeContext } from "./test-helpers";
import { atLevel, GRINNING_SKULL, ARCHANGEL } from "../shared/skill-params";

describe("processAvenge – grinning_skull (independent counters)", () => {
  it("buffs all allies when counter reaches threshold", () => {
    const rel = makeBattleUnit({
      id: "grinning_skull",
      name: "聖骨箱",
      atk: 2,
      hp: 8,
      avengeDeathCount: 3,
      skillUses: 2,
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
      skillUses: 2,
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
    const arch = makeBattleUnit({ id: "archangel", hp: 8 });
    const rel = makeBattleUnit({ id: "grinning_skull", hp: 8 });
    const other = makeBattleUnit({ id: "rat", hp: 3 });
    const board = [arch, rel, other];
    incrementAvengeCounters(board);
    expect(arch.avengeDeathCount).toBe(1);
    expect(rel.avengeDeathCount).toBe(1);
    expect(other.avengeDeathCount).toBe(0);
  });

  it("does not increment dead avenge units", () => {
    const arch = makeBattleUnit({ id: "archangel", hp: 0 });
    const board = [arch];
    incrementAvengeCounters(board);
    expect(arch.avengeDeathCount).toBe(0);
  });
});
