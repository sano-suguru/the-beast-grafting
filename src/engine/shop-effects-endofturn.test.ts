import { applyEndOfTurnEffects } from "./shop-effects";
import type { UnitInstance } from "../shared/types";

function makeUnit(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    id: "rat",
    name: "疫病ネズミ",
    baseAtk: 2,
    baseHp: 1,
    tier: 1,
    skillText: "",
    lore: "",
    atk: 2,
    hp: 1,
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
      makeUnit({ atk: 3, hp: 5, uid: "front" }),
      makeUnit({ id: "machine", atk: 1, hp: 2, uid: "machine" }),
      null,
      null,
      null,
    ];
    const result = applyEndOfTurnEffects(board);
    expect(result[0]!.atk).toBe(5);
    expect(result[0]!.hp).toBe(7);
  });

  it("brains does NOT double end-of-turn effects (SAP Tiger rule)", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ atk: 3, hp: 5, uid: "front" }),
      makeUnit({ id: "machine", atk: 1, hp: 2, uid: "machine" }),
      makeUnit({ id: "brains", atk: 4, hp: 3, uid: "brains" }),
      null,
      null,
    ];
    const result = applyEndOfTurnEffects(board);
    expect(result[0]!.atk).toBe(5);
    expect(result[0]!.hp).toBe(7);
  });

  it("multiple machines each buff the front unit", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ atk: 2, hp: 2, uid: "front" }),
      makeUnit({ id: "machine", atk: 1, hp: 2, uid: "m1" }),
      makeUnit({ id: "machine", atk: 1, hp: 2, uid: "m2" }),
      null,
      null,
    ];
    const result = applyEndOfTurnEffects(board);
    expect(result[0]!.atk).toBe(6);
    expect(result[0]!.hp).toBe(6);
  });

  it("finds front even if slot 0 is null", () => {
    const board: (UnitInstance | null)[] = [
      null,
      makeUnit({ atk: 3, hp: 3, uid: "front" }),
      makeUnit({ id: "machine", atk: 1, hp: 2, uid: "machine" }),
      null,
      null,
    ];
    const result = applyEndOfTurnEffects(board);
    expect(result[1]!.atk).toBe(5);
    expect(result[1]!.hp).toBe(5);
  });
});

describe("applyEndOfTurnEffects – no effects", () => {
  it("returns original board when no effects triggered", () => {
    const board: (UnitInstance | null)[] = [makeUnit(), null, null, null, null];
    const result = applyEndOfTurnEffects(board);
    expect(result).toBe(board);
  });
});
