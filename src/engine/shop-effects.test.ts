import {
  graftUnits,
  applyBuyEffects,
  applyChaliceEffect,
  applySummonEffects,
} from "./shop-effects";
import { ITEMS } from "../shared/data/items";
import type { UnitInstance, ShopItemSlot } from "../shared/types";

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

describe("graftUnits", () => {
  it("adds material stats to base", () => {
    const base = makeUnit({ atk: 3, hp: 2 });
    const material = makeUnit({ atk: 2, hp: 1 });
    const result = graftUnits(base, material);
    expect(result.atk).toBe(5);
    expect(result.hp).toBe(3);
  });

  it("increments exp by 1", () => {
    const base = makeUnit({ exp: 0 });
    const result = graftUnits(base, makeUnit());
    expect(result.exp).toBe(1);
  });

  it("levels up when exp reaches level * 2", () => {
    const base = makeUnit({ level: 1, exp: 1 });
    const result = graftUnits(base, makeUnit());
    expect(result.level).toBe(2);
  });

  it("does not level up when exp is below threshold", () => {
    const base = makeUnit({ level: 1, exp: 0 });
    const result = graftUnits(base, makeUnit());
    expect(result.level).toBe(1);
  });

  it("caps level at 3", () => {
    const base = makeUnit({ level: 3, exp: 100 });
    const result = graftUnits(base, makeUnit());
    expect(result.level).toBe(3);
  });

  it("preserves base unit properties", () => {
    const base = makeUnit({ id: "beast", equip: "iron", uid: "base-uid" });
    const result = graftUnits(base, makeUnit());
    expect(result.id).toBe("beast");
    expect(result.equip).toBe("iron");
    expect(result.uid).toBe("base-uid");
  });
});

describe("applyBuyEffects – rot_ring", () => {
  it("buffs all board units when Tier 1 bought with rot_ring on board", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "rot_ring", atk: 6, hp: 8 }),
      makeUnit({ atk: 2, hp: 1 }),
      null,
      null,
      null,
    ];
    const boughtUnit = makeUnit({ tier: 1 });
    const { board: result } = applyBuyEffects(boughtUnit, board);
    expect(result[0]!.atk).toBe(7);
    expect(result[0]!.hp).toBe(9);
    expect(result[1]!.atk).toBe(3);
    expect(result[1]!.hp).toBe(2);
  });

  it("stacks multiple rot_ring buffs", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "rot_ring", atk: 6, hp: 8 }),
      makeUnit({ id: "rot_ring", atk: 6, hp: 8 }),
      null,
      null,
      null,
    ];
    const { board: result } = applyBuyEffects(makeUnit({ tier: 1 }), board);
    expect(result[0]!.atk).toBe(8);
    expect(result[0]!.hp).toBe(10);
  });

  it("does not trigger rot_ring for non-Tier1 units", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "rot_ring", atk: 6, hp: 8 }),
      null,
      null,
      null,
      null,
    ];
    const { board: result } = applyBuyEffects(makeUnit({ tier: 3 }), board);
    expect(result[0]!.atk).toBe(6);
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
      makeUnit({ atk: 2, hp: 3 }),
      null,
      null,
      null,
    ];
    const result = applySummonEffects(1, board);
    expect(result[1]!.atk).toBe(5);
    expect(result[1]!.hp).toBe(4);
  });

  it("stacks multiple altar buffs", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "altar" }),
      makeUnit({ atk: 1, hp: 1 }),
      makeUnit({ id: "altar" }),
      null,
      null,
    ];
    const result = applySummonEffects(1, board);
    expect(result[1]!.atk).toBe(7);
    expect(result[1]!.hp).toBe(3);
  });
});

describe("applySummonEffects – zealot buffs", () => {
  it("zealot buffs placed unit +1 ATK", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "zealot" }),
      makeUnit({ atk: 2, hp: 3 }),
      null,
      null,
      null,
    ];
    const result = applySummonEffects(1, board);
    expect(result[1]!.atk).toBe(3);
    expect(result[1]!.hp).toBe(3);
  });

  it("multiple zealots stack ATK buff", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "zealot", uid: "z1" }),
      makeUnit({ atk: 1, hp: 1 }),
      makeUnit({ id: "zealot", uid: "z2" }),
      null,
      null,
    ];
    const result = applySummonEffects(1, board);
    expect(result[1]!.atk).toBe(3);
    expect(result[1]!.hp).toBe(1);
  });
});

describe("applySummonEffects – combined and edge cases", () => {
  it("zealot and altar both apply to placed unit", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "altar" }),
      makeUnit({ atk: 1, hp: 1 }),
      makeUnit({ id: "zealot" }),
      null,
      null,
    ];
    const result = applySummonEffects(1, board);
    expect(result[1]!.atk).toBe(5); // 1 + 3(altar) + 1(zealot)
    expect(result[1]!.hp).toBe(2); // 1 + 1(altar)
  });

  it("returns original board when no altar present", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit(),
      makeUnit({ atk: 2, hp: 3 }),
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
