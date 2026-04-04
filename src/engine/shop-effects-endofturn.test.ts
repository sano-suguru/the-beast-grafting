import { applyEndOfTurnEffects } from "./shop-effects";
import type { UnitInstance } from "../shared/types";
import { effectiveAtk, effectiveHp } from "../shared/unit-stats";

function makeUnit(overrides: Partial<UnitInstance> = {}): UnitInstance {
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
    level: 1,
    exp: 0,
    equip: null,
    uid: "test-uid-1",
    isChurch: false,
    ...overrides,
  };
}

describe("applyEndOfTurnEffects – machine", () => {
  it("buffs frontmost unit +2/+2", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ baseAtk: 3, baseHp: 5, uid: "front" }),
      makeUnit({ id: "machine", baseAtk: 1, baseHp: 2, uid: "machine" }),
      null,
      null,
      null,
    ];
    const result = applyEndOfTurnEffects(board);
    expect(effectiveAtk(result[0]!)).toBe(5);
    expect(effectiveHp(result[0]!)).toBe(7);
  });

  it("brains does NOT double end-of-turn effects (SAP Tiger rule)", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ baseAtk: 3, baseHp: 5, uid: "front" }),
      makeUnit({ id: "machine", baseAtk: 1, baseHp: 2, uid: "machine" }),
      makeUnit({ id: "brains", baseAtk: 4, baseHp: 3, uid: "brains" }),
      null,
      null,
    ];
    const result = applyEndOfTurnEffects(board);
    expect(effectiveAtk(result[0]!)).toBe(5);
    expect(effectiveHp(result[0]!)).toBe(7);
  });

  it("multiple machines each buff the front unit", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ baseAtk: 2, baseHp: 2, uid: "front" }),
      makeUnit({ id: "machine", baseAtk: 1, baseHp: 2, uid: "m1" }),
      makeUnit({ id: "machine", baseAtk: 1, baseHp: 2, uid: "m2" }),
      null,
      null,
    ];
    const result = applyEndOfTurnEffects(board);
    expect(effectiveAtk(result[0]!)).toBe(6);
    expect(effectiveHp(result[0]!)).toBe(6);
  });

  it("finds front even if slot 0 is null", () => {
    const board: (UnitInstance | null)[] = [
      null,
      makeUnit({ baseAtk: 3, baseHp: 3, uid: "front" }),
      makeUnit({ id: "machine", baseAtk: 1, baseHp: 2, uid: "machine" }),
      null,
      null,
    ];
    const result = applyEndOfTurnEffects(board);
    expect(effectiveAtk(result[1]!)).toBe(5);
    expect(effectiveHp(result[1]!)).toBe(5);
  });
});

describe("applyEndOfTurnEffects – no effects", () => {
  it("returns original board when no effects triggered", () => {
    const board: (UnitInstance | null)[] = [makeUnit(), null, null, null, null];
    const result = applyEndOfTurnEffects(board);
    expect(result).toBe(board);
  });
});
