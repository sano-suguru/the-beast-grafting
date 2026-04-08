import {
  graftUnits,
  applyBuyEffects,
  applyChaliceEffect,
  applySummonEffects,
} from "./shop-effects";
import { ITEMS } from "../shared/data/items";
import type { UnitInstance, ShopItemSlot } from "../shared/types";
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

describe("graftUnits", () => {
  it("takes higher stats and adds +1/+1", () => {
    const base = makeUnit({ baseAtk: 3, baseHp: 2 });
    const material = makeUnit({ baseAtk: 2, baseHp: 4 });
    const { unit } = graftUnits(base, material);
    expect(unit.baseAtk).toBe(4); // max(3,2) + 1
    expect(unit.baseHp).toBe(5); // max(2,4) + 1
  });

  it("includes buffs when comparing stats", () => {
    const base = makeUnit({ baseAtk: 1, baseHp: 1, buffAtk: 5, buffHp: 0 });
    const material = makeUnit({ baseAtk: 3, baseHp: 3 });
    const { unit } = graftUnits(base, material);
    expect(unit.baseAtk).toBe(7); // max(1+5, 3) + 1
    expect(unit.baseHp).toBe(4); // max(1+0, 3) + 1
    expect(unit.buffAtk).toBe(0);
    expect(unit.buffHp).toBe(0);
  });

  it("increments exp by 1", () => {
    const base = makeUnit({ exp: 0 });
    const { unit } = graftUnits(base, makeUnit());
    expect(unit.exp).toBe(1);
  });

  it("levels up to Lv2 at 2 exp", () => {
    const base = makeUnit({ level: 1, exp: 1 });
    const result = graftUnits(base, makeUnit());
    expect(result.unit.level).toBe(2);
    expect(result.leveledUp).toBe(true);
  });

  it("does not level up at 1 exp", () => {
    const base = makeUnit({ level: 1, exp: 0 });
    const result = graftUnits(base, makeUnit());
    expect(result.unit.level).toBe(1);
    expect(result.leveledUp).toBe(false);
  });

  it("levels up to Lv3 at 5 cumulative exp", () => {
    const base = makeUnit({ level: 2, exp: 4 });
    const result = graftUnits(base, makeUnit());
    expect(result.unit.level).toBe(3);
    expect(result.leveledUp).toBe(true);
  });

  it("does not level up to Lv3 at 4 cumulative exp", () => {
    const base = makeUnit({ level: 2, exp: 3 });
    const result = graftUnits(base, makeUnit());
    expect(result.unit.level).toBe(2);
    expect(result.leveledUp).toBe(false);
  });

  it("caps level at 3", () => {
    const base = makeUnit({ level: 3, exp: 100 });
    const result = graftUnits(base, makeUnit());
    expect(result.unit.level).toBe(3);
    expect(result.leveledUp).toBe(false);
  });

  it("preserves base unit properties", () => {
    const base = makeUnit({ id: "beast", equip: "iron", uid: "base-uid" });
    const { unit } = graftUnits(base, makeUnit());
    expect(unit.id).toBe("beast");
    expect(unit.equip).toBe("iron");
    expect(unit.uid).toBe("base-uid");
  });

  it("uses material effective stats when material has buffs but base does not", () => {
    const base = makeUnit({ baseAtk: 2, baseHp: 2, buffAtk: 0, buffHp: 0 });
    const material = makeUnit({ baseAtk: 1, baseHp: 1, buffAtk: 2, buffHp: 3 });
    const { unit } = graftUnits(base, material);
    // material effectiveAtk = 1+2 = 3, base effectiveAtk = 2+0 = 2 → max=3, +1 = 4
    expect(unit.baseAtk).toBe(4);
    // material effectiveHp = 1+3 = 4, base effectiveHp = 2+0 = 2 → max=4, +1 = 5
    expect(unit.baseHp).toBe(5);
    expect(unit.buffAtk).toBe(0);
    expect(unit.buffHp).toBe(0);
  });
});

describe("applyBuyEffects – rot_ring", () => {
  it("buffs all board units when Tier 1 bought with rot_ring on board", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "rot_ring", baseAtk: 6, baseHp: 8 }),
      makeUnit({ baseAtk: 2, baseHp: 1 }),
      null,
      null,
      null,
    ];
    const boughtUnit = makeUnit({ tier: 1 });
    const { board: result } = applyBuyEffects(boughtUnit, board);
    expect(effectiveAtk(result[0]!)).toBe(7);
    expect(effectiveHp(result[0]!)).toBe(9);
    expect(effectiveAtk(result[1]!)).toBe(3);
    expect(effectiveHp(result[1]!)).toBe(2);
  });

  it("stacks multiple rot_ring buffs", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "rot_ring", baseAtk: 6, baseHp: 8 }),
      makeUnit({ id: "rot_ring", baseAtk: 6, baseHp: 8 }),
      null,
      null,
      null,
    ];
    const { board: result } = applyBuyEffects(makeUnit({ tier: 1 }), board);
    expect(effectiveAtk(result[0]!)).toBe(8);
    expect(effectiveHp(result[0]!)).toBe(10);
  });

  it("does not trigger rot_ring for non-Tier1 units", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "rot_ring", baseAtk: 6, baseHp: 8 }),
      null,
      null,
      null,
      null,
    ];
    const { board: result } = applyBuyEffects(makeUnit({ tier: 3 }), board);
    expect(effectiveAtk(result[0]!)).toBe(6);
  });

  it("Lv2 rot_ring allows up to 5 uses", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "rot_ring", baseAtk: 6, baseHp: 8, level: 2 }),
      null,
      null,
      null,
      null,
    ];
    // Lv2 uses = 5; 4回使用済みでもまだ発動する
    const { rotRingUses } = applyBuyEffects(makeUnit({ tier: 1 }), board, 4);
    expect(rotRingUses).toBe(5);
  });

  it("Lv2 rot_ring stops at 5 uses", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "rot_ring", baseAtk: 6, baseHp: 8, level: 2 }),
      null,
      null,
      null,
      null,
    ];
    // Lv2 uses = 5; 5回使用済みなら発動しない
    const { board: result } = applyBuyEffects(makeUnit({ tier: 1 }), board, 5);
    expect(effectiveAtk(result[0]!)).toBe(6);
  });

  it("mixed Lv1+Lv2 rot_rings sum totalMaxUses", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "rot_ring", baseAtk: 6, baseHp: 8, level: 1 }),
      makeUnit({ id: "rot_ring", baseAtk: 6, baseHp: 8, level: 2 }),
      null,
      null,
      null,
    ];
    // Lv1(4) + Lv2(5) = totalMaxUses 9; 8回使用済みでもまだ発動
    const { rotRingUses } = applyBuyEffects(makeUnit({ tier: 1 }), board, 8);
    expect(rotRingUses).toBe(9);
  });
});

describe("applyBuyEffects – chalice and fallback", () => {
  it("sets chaliceTriggered when chalice is bought", () => {
    const board: (UnitInstance | null)[] = [null, null, null, null, null];
    const boughtUnit = makeUnit({ id: "chalice" });
    const { chaliceTriggered } = applyBuyEffects(boughtUnit, board);
    expect(chaliceTriggered).toBe(true);
  });

  it("returns original board reference when no effects triggered", () => {
    const board: (UnitInstance | null)[] = [makeUnit(), null, null, null, null];
    const boughtUnit = makeUnit({ tier: 2, id: "beast" });
    const { board: result } = applyBuyEffects(boughtUnit, board);
    expect(result).toBe(board);
  });
});

describe("applyChaliceEffect", () => {
  it("converts all non-null items to pure_blood", () => {
    const shopItems: (ShopItemSlot | null)[] = [
      { item: ITEMS["iron_plate"]!, frozen: false },
      { item: ITEMS["bile"]!, frozen: true },
      null,
    ];
    const result = applyChaliceEffect(shopItems);
    expect(result[0]!.item.id).toBe("pure_blood");
    expect(result[1]!.item.id).toBe("pure_blood");
    expect(result[2]).toBeNull();
  });

  it("replaces with exactly 2 unfrozen items", () => {
    const shopItems: (ShopItemSlot | null)[] = [
      { item: ITEMS["iron_plate"]!, frozen: false },
      { item: ITEMS["bile"]!, frozen: true },
    ];
    const result = applyChaliceEffect(shopItems);
    expect(result[0]!.frozen).toBe(false);
    expect(result[1]!.frozen).toBe(false);
  });
});

describe("applySummonEffects – altar buffs", () => {
  it("buffs summoned unit when altar is on board", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "altar" }),
      makeUnit({ baseAtk: 2, baseHp: 3 }),
      null,
      null,
      null,
    ];
    const result = applySummonEffects(1, board);
    expect(effectiveAtk(result[1]!)).toBe(5);
    expect(effectiveHp(result[1]!)).toBe(4);
  });

  it("stacks multiple altar buffs", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "altar" }),
      makeUnit({ baseAtk: 1, baseHp: 1 }),
      makeUnit({ id: "altar" }),
      null,
      null,
    ];
    const result = applySummonEffects(1, board);
    expect(effectiveAtk(result[1]!)).toBe(7);
    expect(effectiveHp(result[1]!)).toBe(3);
  });
});

describe("applySummonEffects – zealot buffs", () => {
  it("zealot buffs placed unit +1 ATK", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "zealot" }),
      makeUnit({ baseAtk: 2, baseHp: 3 }),
      null,
      null,
      null,
    ];
    const result = applySummonEffects(1, board);
    expect(effectiveAtk(result[1]!)).toBe(3);
    expect(effectiveHp(result[1]!)).toBe(3);
  });

  it("multiple zealots stack ATK buff", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "zealot", uid: "z1" }),
      makeUnit({ baseAtk: 1, baseHp: 1 }),
      makeUnit({ id: "zealot", uid: "z2" }),
      null,
      null,
    ];
    const result = applySummonEffects(1, board);
    expect(effectiveAtk(result[1]!)).toBe(3);
    expect(effectiveHp(result[1]!)).toBe(1);
  });
});

describe("applySummonEffects – combined and edge cases", () => {
  it("zealot and altar both apply to placed unit", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "altar" }),
      makeUnit({ baseAtk: 1, baseHp: 1 }),
      makeUnit({ id: "zealot" }),
      null,
      null,
    ];
    const result = applySummonEffects(1, board);
    expect(effectiveAtk(result[1]!)).toBe(5); // 1 + 3(altar) + 1(zealot)
    expect(effectiveHp(result[1]!)).toBe(2); // 1 + 1(altar)
  });

  it("returns original board when no altar present", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit(),
      makeUnit({ baseAtk: 2, baseHp: 3 }),
      null,
      null,
      null,
    ];
    const result = applySummonEffects(1, board);
    expect(result).toBe(board);
  });

  it("returns original board when target is null", () => {
    const board: (UnitInstance | null)[] = [makeUnit({ id: "altar" }), null, null, null, null];
    const result = applySummonEffects(1, board);
    expect(result).toBe(board);
  });
});
