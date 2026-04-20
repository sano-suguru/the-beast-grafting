import {
  graftUnits,
  applyBuyEffects,
  applyChaliceEffect,
  applySummonEffects,
  applyLevelUpEffects,
  applyAltarEndOfTurn,
} from "./shop-effects";
import { applySellEffects } from "./shop-effects-sell";
import { applyCorpseBrokerDoseBuff } from "./shop-effects-dose";
import { ITEMS } from "../shared/data/items";
import type { UnitInstance, ShopItemSlot } from "../shared/types";
import { effectiveAtk, effectiveHp } from "../shared/unit-stats";
import { createSeededRng } from "./rng";
import { atLevel, CORPSE_BROKER, GUT_HAND, BONE_JAW, ROT_FEEDER } from "../shared/skill-params";
import { makeUnit } from "./test-helpers";

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
    const base = makeUnit({ id: "beast", equip: "iron_plate", uid: "base-uid" });
    const { unit } = graftUnits(base, makeUnit());
    expect(unit.id).toBe("beast");
    expect(unit.equip).toBe("iron_plate");
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
    const { board: result } = applyBuyEffects(boughtUnit, board, 0, createSeededRng(1), 0);
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
    const { board: result } = applyBuyEffects(
      makeUnit({ tier: 1 }),
      board,
      0,
      createSeededRng(1),
      0,
    );
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
    const { board: result } = applyBuyEffects(
      makeUnit({ tier: 3 }),
      board,
      0,
      createSeededRng(1),
      0,
    );
    expect(effectiveAtk(result[0]!)).toBe(6);
  });

  it("Lv2 rot_ring allows up to 4 uses", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "rot_ring", baseAtk: 6, baseHp: 8, level: 2 }),
      null,
      null,
      null,
      null,
    ];
    // Lv2 uses = 4; 3回使用済みでもまだ発動する
    const { rotRingUses } = applyBuyEffects(makeUnit({ tier: 1 }), board, 3, createSeededRng(1), 0);
    expect(rotRingUses).toBe(4);
  });

  it("Lv2 rot_ring stops at 4 uses", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "rot_ring", baseAtk: 6, baseHp: 8, level: 2 }),
      null,
      null,
      null,
      null,
    ];
    // Lv2 uses = 4; 4回使用済みなら発動しない
    const { board: result } = applyBuyEffects(
      makeUnit({ tier: 1 }),
      board,
      4,
      createSeededRng(1),
      0,
    );
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
    // Lv1(4) + Lv2(4) = totalMaxUses 8; 7回使用済みでもまだ発動
    const { rotRingUses } = applyBuyEffects(makeUnit({ tier: 1 }), board, 7, createSeededRng(1), 0);
    expect(rotRingUses).toBe(8);
  });
});

describe("applyBuyEffects – chalice and fallback", () => {
  it("sets chaliceLevel when chalice is bought", () => {
    const board: (UnitInstance | null)[] = [null, null, null, null, null];
    const boughtUnit = makeUnit({ id: "chalice", level: 2 });
    const { chaliceLevel } = applyBuyEffects(boughtUnit, board, 0, createSeededRng(1), 0);
    expect(chaliceLevel).toBe(2);
  });

  it("returns null chaliceLevel for non-chalice unit", () => {
    const board: (UnitInstance | null)[] = [null, null, null, null, null];
    const boughtUnit = makeUnit({ id: "beast" });
    const { chaliceLevel } = applyBuyEffects(boughtUnit, board, 0, createSeededRng(1), 0);
    expect(chaliceLevel).toBeNull();
  });

  it("returns original board reference when no effects triggered", () => {
    const board: (UnitInstance | null)[] = [makeUnit(), null, null, null, null];
    const boughtUnit = makeUnit({ tier: 2, id: "beast" });
    const { board: result } = applyBuyEffects(boughtUnit, board, 0, createSeededRng(1), 0);
    expect(result).toBe(board);
  });
});

describe("applyChaliceEffect", () => {
  it("Lv1 converts slots to pure_blood", () => {
    const shopItems: (ShopItemSlot | null)[] = [
      { item: ITEMS["bile"]!, frozen: false },
      { item: ITEMS["bile"]!, frozen: true },
      null,
    ];
    const result = applyChaliceEffect(shopItems, 1);
    expect(result[0]!.item.id).toBe("pure_blood");
    expect(result[1]!.item.id).toBe("pure_blood");
    expect(result[2]).toBeNull();
  });

  it("Lv2 converts slots to pure_blood_2", () => {
    const shopItems: (ShopItemSlot | null)[] = [
      { item: ITEMS["bile"]!, frozen: false },
      { item: ITEMS["bile"]!, frozen: true },
    ];
    const result = applyChaliceEffect(shopItems, 2);
    expect(result[0]!.item.id).toBe("pure_blood_2");
    expect(result[1]!.item.id).toBe("pure_blood_2");
  });

  it("Lv3 converts slots to pure_blood_3", () => {
    const shopItems: (ShopItemSlot | null)[] = [
      { item: ITEMS["bile"]!, frozen: false },
      { item: ITEMS["bile"]!, frozen: true },
    ];
    const result = applyChaliceEffect(shopItems, 3);
    expect(result[0]!.item.id).toBe("pure_blood_3");
    expect(result[1]!.item.id).toBe("pure_blood_3");
  });

  it("replaces with exactly 2 unfrozen items", () => {
    const shopItems: (ShopItemSlot | null)[] = [
      { item: ITEMS["bile"]!, frozen: false },
      { item: ITEMS["bile"]!, frozen: true },
    ];
    const result = applyChaliceEffect(shopItems, 1);
    expect(result[0]!.frozen).toBe(false);
    expect(result[1]!.frozen).toBe(false);
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
    expect(effectiveAtk(result[1]!)).toBe(3); // 2 + 1(zealot)
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
    expect(effectiveAtk(result[1]!)).toBe(3); // 1 + 1×2(zealot)
    expect(effectiveHp(result[1]!)).toBe(1);
  });
});

describe("applySummonEffects – combined and edge cases", () => {
  it("zealot applies to placed unit (altar no longer buffs summons)", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "altar" }),
      makeUnit({ baseAtk: 1, baseHp: 1 }),
      makeUnit({ id: "zealot" }),
      null,
      null,
    ];
    const result = applySummonEffects(1, board);
    expect(effectiveAtk(result[1]!)).toBe(2); // 1 + 1(zealot)
    expect(effectiveHp(result[1]!)).toBe(1); // no altar buff
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

describe("applySellEffects – determinism", () => {
  it("bone_jaw self-sell buff is deterministic with seeded rng", () => {
    const jaw = makeUnit({ id: "bone_jaw", uid: "bj-1" });
    const ally1 = makeUnit({ uid: "ally-1" });
    const ally2 = makeUnit({ uid: "ally-2" });
    const board: (UnitInstance | null)[] = [null, ally1, ally2];

    const rng1 = createSeededRng(99);
    const result1 = applySellEffects(jaw, board, rng1);

    const rng2 = createSeededRng(99);
    const result2 = applySellEffects(jaw, board, rng2);

    const sum1 = result1.board.reduce((s, u) => s + (u?.buffAtk ?? 0), 0);
    const sum2 = result2.board.reduce((s, u) => s + (u?.buffAtk ?? 0), 0);
    expect(sum1).toBe(sum2);
    expect(sum1).toBeGreaterThan(0);
  });
});

// ── gut_hand: 自身が購入された時に味方にHPバフ ──

describe("applyBuyEffects – gut_hand", () => {
  it("buffs a random ally buffHp when gut_hand is bought (Lv1)", () => {
    const gutHand = makeUnit({ id: "gut_hand", uid: "gh-1" });
    const ally = makeUnit({ id: "rat", uid: "ally-1" });
    const board: (UnitInstance | null)[] = [gutHand, ally];
    const bought = makeUnit({ id: "gut_hand", uid: "gh-1" });
    const rng = createSeededRng(42);
    const result = applyBuyEffects(bought, board, 0, rng, 0);
    const totalBuff = result.board
      .filter((u): u is UnitInstance => u !== null)
      .reduce((sum, u) => sum + u.buffHp, 0);
    expect(totalBuff).toBe(GUT_HAND.hpBuff);
  });

  it("does not buff when a non-gut_hand unit is bought", () => {
    const gutHand = makeUnit({ id: "gut_hand", uid: "gh-1" });
    const ally = makeUnit({ id: "rat", uid: "ally-1" });
    const board: (UnitInstance | null)[] = [gutHand, ally];
    const bought = makeUnit({ id: "rat", uid: "bought-1" });
    const rng = createSeededRng(42);
    const result = applyBuyEffects(bought, board, 0, rng, 0);
    const totalBuff = result.board
      .filter((u): u is UnitInstance => u !== null)
      .reduce((sum, u) => sum + u.buffHp, 0);
    expect(totalBuff).toBe(0);
  });

  it("excludes gut_hand itself from buff targets", () => {
    const gutHand = makeUnit({ id: "gut_hand", uid: "gh-1" });
    const ally = makeUnit({ id: "rat", uid: "ally-1" });
    const board: (UnitInstance | null)[] = [gutHand, ally];
    const bought = makeUnit({ id: "gut_hand", uid: "gh-1" });
    for (let seed = 1; seed <= 20; seed++) {
      const result = applyBuyEffects(bought, [...board], 0, createSeededRng(seed), 0);
      const ghResult = result.board[0] as UnitInstance;
      const allyResult = result.board[1] as UnitInstance;
      expect(ghResult.buffHp).toBe(0);
      expect(allyResult.buffHp).toBe(GUT_HAND.hpBuff);
    }
  });

  it("Lv2 gut_hand buffs 2 allies", () => {
    const gutHand = makeUnit({ id: "gut_hand", uid: "gh-1", level: 2 });
    const ally1 = makeUnit({ uid: "a1" });
    const ally2 = makeUnit({ uid: "a2" });
    const board: (UnitInstance | null)[] = [gutHand, ally1, ally2, null, null];
    const bought = makeUnit({ id: "gut_hand", uid: "gh-1" });
    const rng = createSeededRng(42);
    const result = applyBuyEffects(bought, board, 0, rng, 0);
    const totalBuff = result.board
      .filter((u): u is UnitInstance => u !== null && u.uid !== "gh-1")
      .reduce((sum, u) => sum + u.buffHp, 0);
    expect(totalBuff).toBe(GUT_HAND.hpBuff * 2);
  });
});

// ── bone_jaw: 自身が売却された時に味方2体にATKバフ ──

describe("applySellEffects – bone_jaw self-sell", () => {
  it("buffs 2 allies with ATK when bone_jaw is sold (Lv1)", () => {
    const jaw = makeUnit({ id: "bone_jaw", uid: "bj-1" });
    const ally1 = makeUnit({ uid: "a1" });
    const ally2 = makeUnit({ uid: "a2" });
    const board: (UnitInstance | null)[] = [null, ally1, ally2];
    const rng = createSeededRng(42);
    const result = applySellEffects(jaw, board, rng);
    const totalAtk = result.board
      .filter((u): u is UnitInstance => u !== null)
      .reduce((s, u) => s + u.buffAtk, 0);
    expect(totalAtk).toBe(atLevel(BONE_JAW.atkBuff, 1) * BONE_JAW.targets);
  });

  it("does not trigger when a different unit is sold (bone_jaw stays on board)", () => {
    const jaw = makeUnit({ id: "bone_jaw", uid: "bj-1" });
    const board: (UnitInstance | null)[] = [jaw, null];
    const sold = makeUnit({ uid: "sold-1" });
    const rng = createSeededRng(1);
    const result = applySellEffects(sold, board, rng);
    const updated = result.board[0] as UnitInstance;
    expect(updated.buffAtk).toBe(0);
  });
});

// ── rot_feeder: 自身が売却された時にshopBuff(HP) ──

describe("applySellEffects – rot_feeder self-sell shopBuff", () => {
  it("returns shopBuff with HP when rot_feeder is sold", () => {
    const feeder = makeUnit({ id: "rot_feeder", uid: "rf-1" });
    const board: (UnitInstance | null)[] = [null, null];
    const rng = createSeededRng(1);
    const result = applySellEffects(feeder, board, rng);
    const hpBuff = atLevel(ROT_FEEDER.hpBuff, 1);
    expect(result.shopBuff).toEqual({ atk: 0, hp: hpBuff });
  });

  it("does not trigger when a different unit is sold (rot_feeder stays on board)", () => {
    const feeder = makeUnit({ id: "rot_feeder", uid: "rf-1" });
    const board: (UnitInstance | null)[] = [feeder, null];
    const sold = makeUnit({ uid: "sold-1" });
    const rng = createSeededRng(1);
    const result = applySellEffects(sold, board, rng);
    expect(result.shopBuff).toBeUndefined();
  });

  it("returns only self-sell buff even with market_vulture on board", () => {
    const feeder = makeUnit({ id: "rot_feeder", uid: "rf-1" });
    const vulture = makeUnit({ id: "market_vulture", uid: "mv-1" });
    const board: (UnitInstance | null)[] = [null, vulture];
    const rng = createSeededRng(1);
    const result = applySellEffects(feeder, board, rng);
    const rfHp = atLevel(ROT_FEEDER.hpBuff, 1);
    expect(result.shopBuff).toEqual({ atk: 0, hp: rfHp });
  });
});

// ── corpse_pecker (Pigeon): 自身が売却された時にstockItems(bone_meal) ──

describe("applySellEffects – corpse_pecker self-sell stockItems", () => {
  it("returns bone_meal stockItems when corpse_pecker is sold (Lv1)", () => {
    const pecker = makeUnit({ id: "corpse_pecker", uid: "cp-1" });
    const board: (UnitInstance | null)[] = [null, null];
    const rng = createSeededRng(1);
    const result = applySellEffects(pecker, board, rng);
    expect(result.stockItems).toHaveLength(1);
    expect(result.stockItems![0]!.id).toBe("bone_meal");
    expect(result.stockItems![0]!.cost).toBe(0);
    expect(result.stockItems![0]!.atk).toBe(1);
    expect(result.stockItems![0]!.hp).toBe(0);
  });

  it("Lv2 corpse_pecker returns 2 bone_meal", () => {
    const pecker = makeUnit({ id: "corpse_pecker", uid: "cp-1", level: 2 });
    const board: (UnitInstance | null)[] = [null, null];
    const rng = createSeededRng(1);
    const result = applySellEffects(pecker, board, rng);
    expect(result.stockItems).toHaveLength(2);
  });

  it("does not trigger when a different unit is sold (corpse_pecker stays on board)", () => {
    const pecker = makeUnit({ id: "corpse_pecker", uid: "cp-1" });
    const board: (UnitInstance | null)[] = [pecker, null];
    const sold = makeUnit({ uid: "sold-1" });
    const rng = createSeededRng(1);
    const result = applySellEffects(sold, board, rng);
    expect(result.stockItems).toBeUndefined();
  });

  it("returns no stockItems when a non-corpse_pecker unit is sold", () => {
    const ally = makeUnit({ uid: "ally-1" });
    const board: (UnitInstance | null)[] = [ally, null];
    const sold = makeUnit({ uid: "sold-1" });
    const rng = createSeededRng(1);
    const result = applySellEffects(sold, board, rng);
    expect(result.stockItems).toBeUndefined();
  });
});

// ── nesting_grub: レベルアップ時に味方にバフ ──

describe("applyLevelUpEffects – nesting_grub", () => {
  it("Lv1→Lv2: buffs 2 allies with +1/+1 each", () => {
    const grub = makeUnit({ id: "nesting_grub", uid: "ng-1", level: 2 });
    const ally1 = makeUnit({ uid: "a1" });
    const ally2 = makeUnit({ uid: "a2" });
    const board: (UnitInstance | null)[] = [grub, ally1, ally2, null, null];
    const rng = createSeededRng(42);
    applyLevelUpEffects(board, 0, rng);
    const totalAtk = [board[1], board[2]]
      .filter((u): u is UnitInstance => u !== null)
      .reduce((s, u) => s + u.buffAtk, 0);
    const totalHp = [board[1], board[2]]
      .filter((u): u is UnitInstance => u !== null)
      .reduce((s, u) => s + u.buffHp, 0);
    expect(totalAtk).toBe(2); // +1 × 2 targets
    expect(totalHp).toBe(2);
  });

  it("Lv2→Lv3: buffs 2 allies with +2/+2 each", () => {
    const grub = makeUnit({ id: "nesting_grub", uid: "ng-1", level: 3 });
    const ally1 = makeUnit({ uid: "a1" });
    const ally2 = makeUnit({ uid: "a2" });
    const board: (UnitInstance | null)[] = [grub, ally1, ally2, null, null];
    const rng = createSeededRng(42);
    applyLevelUpEffects(board, 0, rng);
    const totalAtk = [board[1], board[2]]
      .filter((u): u is UnitInstance => u !== null)
      .reduce((s, u) => s + u.buffAtk, 0);
    const totalHp = [board[1], board[2]]
      .filter((u): u is UnitInstance => u !== null)
      .reduce((s, u) => s + u.buffHp, 0);
    expect(totalAtk).toBe(4); // +2 × 2 targets
    expect(totalHp).toBe(4);
  });

  it("excludes nesting_grub itself from buff targets", () => {
    const grub = makeUnit({ id: "nesting_grub", uid: "ng-1", level: 2 });
    const board: (UnitInstance | null)[] = [grub, null, null, null, null];
    const rng = createSeededRng(42);
    applyLevelUpEffects(board, 0, rng);
    expect((board[0] as UnitInstance).buffAtk).toBe(0);
    expect((board[0] as UnitInstance).buffHp).toBe(0);
  });

  it("does not trigger for non-nesting_grub units", () => {
    const rat = makeUnit({ id: "rat", uid: "r-1", level: 2 });
    const ally = makeUnit({ uid: "a1" });
    const board: (UnitInstance | null)[] = [rat, ally, null, null, null];
    const rng = createSeededRng(42);
    applyLevelUpEffects(board, 0, rng);
    expect((board[1] as UnitInstance).buffAtk).toBe(0);
    expect((board[1] as UnitInstance).buffHp).toBe(0);
  });
});

describe("applyCorpseBrokerDoseBuff", () => {
  it("buffs target HP when corpse_broker is on board", () => {
    const broker = makeUnit({ id: "corpse_broker", uid: "cb-1" });
    const target = makeUnit({ id: "rat", uid: "target-1" });
    const board: (UnitInstance | null)[] = [broker, target, null];
    const result = applyCorpseBrokerDoseBuff(board, 1, 0);
    const hpBuff = atLevel(CORPSE_BROKER.hpBuff, 1);
    const updated = result.board.find((u): u is UnitInstance => u !== null && u.uid === "target-1");
    expect(updated!.buffHp).toBe(hpBuff);
    expect(result.corpseBrokerUses).toBe(1);
  });

  it("does not buff when no corpse_broker on board", () => {
    const target = makeUnit({ id: "rat", uid: "target-1" });
    const board: (UnitInstance | null)[] = [target, null];
    const result = applyCorpseBrokerDoseBuff(board, 0, 0);
    expect(result.board).toBe(board);
    expect(result.corpseBrokerUses).toBe(0);
  });

  it("stops buffing after maxUses reached", () => {
    const broker = makeUnit({ id: "corpse_broker", uid: "cb-1" });
    const target = makeUnit({ id: "rat", uid: "target-1" });
    const board: (UnitInstance | null)[] = [broker, target, null];
    const result = applyCorpseBrokerDoseBuff(board, 1, 3);
    expect(result.board).toBe(board);
    expect(result.corpseBrokerUses).toBe(3);
  });

  it("broker 本体を target にした場合、自己分を除外してバフ量を合算する", () => {
    const broker1 = makeUnit({ id: "corpse_broker", uid: "cb-1" });
    const broker2 = makeUnit({ id: "corpse_broker", uid: "cb-2" });
    const board: (UnitInstance | null)[] = [broker1, broker2, null];
    const result = applyCorpseBrokerDoseBuff(board, 0, 0);
    const hpBuff = atLevel(CORPSE_BROKER.hpBuff, 1);
    const updated = result.board.find((u): u is UnitInstance => u?.uid === "cb-1");
    expect(updated!.buffHp).toBe(hpBuff);
    expect(result.corpseBrokerUses).toBe(1);
  });

  it("broker が 1 体のみで自分を target にした場合、バフ量 0 のため発動しない", () => {
    const broker = makeUnit({ id: "corpse_broker", uid: "cb-1" });
    const board: (UnitInstance | null)[] = [broker, null, null];
    const result = applyCorpseBrokerDoseBuff(board, 0, 0);
    expect(result.board).toBe(board);
    expect(result.corpseBrokerUses).toBe(0);
  });
});

describe("applyAltarEndOfTurn – altar (Bison)", () => {
  it("self-buffs altar when Lv3 ally present", () => {
    const altar = makeUnit({ id: "altar", uid: "altar1" });
    const lv3ally = makeUnit({ level: 3, uid: "ally1" });
    const board: (UnitInstance | null)[] = [altar, lv3ally, null, null, null];
    const result = applyAltarEndOfTurn(board);
    const buffedAltar = result.find((u) => u?.uid === "altar1");
    expect(buffedAltar?.buffAtk).toBe(1);
    expect(buffedAltar?.buffHp).toBe(2);
  });

  it("does not buff when no Lv3 ally present", () => {
    const altar = makeUnit({ id: "altar", uid: "altar1" });
    const lv2ally = makeUnit({ level: 2, uid: "ally1" });
    const board: (UnitInstance | null)[] = [altar, lv2ally, null, null, null];
    const result = applyAltarEndOfTurn(board);
    expect(result).toBe(board);
  });

  it("multiple altars each self-buff independently", () => {
    const altar1 = makeUnit({ id: "altar", uid: "a1" });
    const altar2 = makeUnit({ id: "altar", uid: "a2" });
    const lv3ally = makeUnit({ level: 3, uid: "ally1" });
    const board: (UnitInstance | null)[] = [altar1, altar2, lv3ally, null, null];
    const result = applyAltarEndOfTurn(board);
    const buffed1 = result.find((u) => u?.uid === "a1");
    const buffed2 = result.find((u) => u?.uid === "a2");
    expect(buffed1?.buffAtk).toBe(1);
    expect(buffed2?.buffAtk).toBe(1);
  });
});
