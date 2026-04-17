import {
  graftUnits,
  applyBuyEffects,
  applyChaliceEffect,
  applySummonEffects,
  applySellEffects,
  applyBoneTreeBuyEffects,
} from "./shop-effects";
import { ITEMS } from "../shared/data/items";
import type { UnitInstance, ShopItemSlot } from "../shared/types";
import { effectiveAtk, effectiveHp } from "../shared/unit-stats";
import { createSeededRng } from "./rng";
import {
  atLevel,
  BONE_TREE,
  GRAVE_WORM,
  MARKET_VULTURE,
  GHOUL_INFANT,
  TAINTED_PLACENTA,
  CORPSE_BROKER,
} from "../shared/skill-params";
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
    const { board: result } = applyBuyEffects(boughtUnit, board, 0, createSeededRng(1));
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
    const { board: result } = applyBuyEffects(makeUnit({ tier: 1 }), board, 0, createSeededRng(1));
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
    const { board: result } = applyBuyEffects(makeUnit({ tier: 3 }), board, 0, createSeededRng(1));
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
    const { rotRingUses } = applyBuyEffects(makeUnit({ tier: 1 }), board, 4, createSeededRng(1));
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
    const { board: result } = applyBuyEffects(makeUnit({ tier: 1 }), board, 5, createSeededRng(1));
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
    const { rotRingUses } = applyBuyEffects(makeUnit({ tier: 1 }), board, 8, createSeededRng(1));
    expect(rotRingUses).toBe(9);
  });
});

describe("applyBuyEffects – chalice and fallback", () => {
  it("sets chaliceTriggered when chalice is bought", () => {
    const board: (UnitInstance | null)[] = [null, null, null, null, null];
    const boughtUnit = makeUnit({ id: "chalice" });
    const { chaliceTriggered } = applyBuyEffects(boughtUnit, board, 0, createSeededRng(1));
    expect(chaliceTriggered).toBe(true);
  });

  it("returns original board reference when no effects triggered", () => {
    const board: (UnitInstance | null)[] = [makeUnit(), null, null, null, null];
    const boughtUnit = makeUnit({ tier: 2, id: "beast" });
    const { board: result } = applyBuyEffects(boughtUnit, board, 0, createSeededRng(1));
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
    expect(effectiveAtk(result[1]!)).toBe(4); // 2 + 2(altar)
    expect(effectiveHp(result[1]!)).toBe(4); // 3 + 1(altar)
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
    expect(effectiveAtk(result[1]!)).toBe(5); // 1 + 2×2(altar)
    expect(effectiveHp(result[1]!)).toBe(3); // 1 + 1×2(altar)
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
  it("zealot and altar both apply to placed unit", () => {
    const board: (UnitInstance | null)[] = [
      makeUnit({ id: "altar" }),
      makeUnit({ baseAtk: 1, baseHp: 1 }),
      makeUnit({ id: "zealot" }),
      null,
      null,
    ];
    const result = applySummonEffects(1, board);
    expect(effectiveAtk(result[1]!)).toBe(4); // 1 + 2(altar) + 1(zealot)
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

describe("applySellEffects – determinism", () => {
  it("grave_worm sell buff is deterministic with seeded rng", () => {
    const worm = makeUnit({ id: "grave_worm", uid: "worm-1" });
    const ally = makeUnit({ uid: "ally-1" });
    const sold = makeUnit({ uid: "sold-1" });
    const board: (UnitInstance | null)[] = [worm, ally, null];

    const rng1 = createSeededRng(99);
    const result1 = applySellEffects(sold, board, rng1);

    const rng2 = createSeededRng(99);
    const result2 = applySellEffects(sold, board, rng2);

    const buffed1 = result1.board.find((u) => u?.uid === "ally-1");
    const buffed2 = result2.board.find((u) => u?.uid === "ally-1");
    expect(buffed1!.buffAtk).toBe(buffed2!.buffAtk);
    expect(buffed1!.buffHp).toBe(buffed2!.buffHp);
    // Lv1: +0/+1
    expect(buffed1!.buffHp).toBeGreaterThan(0);
  });

  it("ash_fungus sell buff is deterministic with seeded rng", () => {
    const sold = makeUnit({ uid: "sold-1", baseAtk: 10, baseHp: 10 });
    const taxer = makeUnit({ id: "ash_fungus", uid: "tax-1" });
    const ally = makeUnit({ uid: "ally-1" });
    const board: (UnitInstance | null)[] = [taxer, ally, null];

    const rng1 = createSeededRng(42);
    const result1 = applySellEffects(sold, board, rng1);

    const rng2 = createSeededRng(42);
    const result2 = applySellEffects(sold, board, rng2);

    const sum1 = result1.board.reduce((s, u) => s + (u?.buffAtk ?? 0) + (u?.buffHp ?? 0), 0);
    const sum2 = result2.board.reduce((s, u) => s + (u?.buffAtk ?? 0) + (u?.buffHp ?? 0), 0);
    expect(sum1).toBe(sum2);
    expect(sum1).toBeGreaterThan(0);
  });
});

describe("applyBoneTreeBuyEffects – bone_tree", () => {
  it("buffs all allies by flat amount", () => {
    const throne = makeUnit({ id: "bone_tree", uid: "throne-1" });
    const ally = makeUnit({ uid: "ally-1" });
    const board: (UnitInstance | null)[] = [throne, ally, null];
    const result = applyBoneTreeBuyEffects(board);
    const b = atLevel(BONE_TREE.buff, 1);
    const throneResult = result.find((u) => u?.uid === "throne-1");
    const allyResult = result.find((u) => u?.uid === "ally-1");
    expect(throneResult!.buffAtk).toBe(b.atk);
    expect(throneResult!.buffHp).toBe(b.hp);
    expect(allyResult!.buffAtk).toBe(b.atk);
    expect(allyResult!.buffHp).toBe(b.hp);
  });

  it("returns original board when no throne on board", () => {
    const ally = makeUnit({ uid: "ally-1" });
    const board: (UnitInstance | null)[] = [ally, null];
    const result = applyBoneTreeBuyEffects(board);
    expect(result).toBe(board);
  });
});

describe("applySellEffects – market_vulture shopBuff", () => {
  it("returns shopBuff when market_vulture is on board", () => {
    const merchant = makeUnit({ id: "market_vulture", uid: "bm-1" });
    const board: (UnitInstance | null)[] = [merchant, null];
    const sold = makeUnit({ uid: "sold-1" });
    const rng = createSeededRng(1);
    const result = applySellEffects(sold, board, rng);
    const b = atLevel(MARKET_VULTURE.shopBuff, 1);
    expect(result.shopBuff).toEqual({ atk: b.atk, hp: b.hp });
  });

  it("returns no shopBuff when no market_vulture", () => {
    const ally = makeUnit({ uid: "ally-1" });
    const board: (UnitInstance | null)[] = [ally, null];
    const sold = makeUnit({ uid: "sold-1" });
    const rng = createSeededRng(1);
    const result = applySellEffects(sold, board, rng);
    expect(result.shopBuff).toBeUndefined();
  });
});

// ── ghoul_infant: 購入時に味方にATKバフ ──

describe("applyBuyEffects – ghoul_infant", () => {
  it("buffs a random ally tempBuffAtk when ghoul_infant is on board", () => {
    const ghoul = makeUnit({ id: "ghoul_infant", uid: "gi-1" });
    const ally = makeUnit({ id: "rat", uid: "ally-1" });
    const board: (UnitInstance | null)[] = [ghoul, ally];
    const bought = makeUnit({ uid: "bought-1" });
    const rng = createSeededRng(42);
    const result = applyBuyEffects(bought, board, 0, rng);
    const b = atLevel(GHOUL_INFANT.atkBuff, 1);
    const totalTempBuff = result.board
      .filter((u): u is UnitInstance => u !== null)
      .reduce((sum, u) => sum + u.tempBuffAtk, 0);
    expect(totalTempBuff).toBe(b);
  });

  it("does not buff when no ghoul_infant on board", () => {
    const ally = makeUnit({ id: "rat", uid: "ally-1" });
    const board: (UnitInstance | null)[] = [ally, null];
    const bought = makeUnit({ uid: "bought-1" });
    const rng = createSeededRng(42);
    const result = applyBuyEffects(bought, board, 0, rng);
    const totalTempBuff = result.board
      .filter((u): u is UnitInstance => u !== null)
      .reduce((sum, u) => sum + u.tempBuffAtk, 0);
    expect(totalTempBuff).toBe(0);
  });

  it("excludes ghoul_infant itself from buff targets", () => {
    const ghoul = makeUnit({ id: "ghoul_infant", uid: "gi-1" });
    const ally = makeUnit({ id: "rat", uid: "ally-1" });
    const board: (UnitInstance | null)[] = [ghoul, ally];
    const bought = makeUnit({ uid: "bought-1" });
    for (let seed = 1; seed <= 20; seed++) {
      const result = applyBuyEffects(bought, [...board], 0, createSeededRng(seed));
      const ghoulResult = result.board[0] as UnitInstance;
      const allyResult = result.board[1] as UnitInstance;
      expect(ghoulResult.tempBuffAtk).toBe(0);
      expect(allyResult.tempBuffAtk).toBe(atLevel(GHOUL_INFANT.atkBuff, 1));
    }
  });
});

// ── tainted_placenta: 購入時にshopBuff返却 ──

describe("applyBuyEffects – tainted_placenta", () => {
  it("returns shopBuff when tainted_placenta is bought", () => {
    const board: (UnitInstance | null)[] = [null, null];
    const bought = makeUnit({ id: "tainted_placenta", uid: "tp-1" });
    const result = applyBuyEffects(bought, board, 0, createSeededRng(1));
    const b = atLevel(TAINTED_PLACENTA.shopBuff, 1);
    expect(result.shopBuff).toEqual(b);
  });

  it("returns no shopBuff when other unit is bought", () => {
    const board: (UnitInstance | null)[] = [null, null];
    const bought = makeUnit({ id: "rat", uid: "r-1" });
    const result = applyBuyEffects(bought, board, 0, createSeededRng(1));
    expect(result.shopBuff).toBeUndefined();
  });
});

// ── corpse_broker: 売却時に自身にバフ ──

describe("applySellEffects – corpse_broker", () => {
  it("buffs corpse_broker on ally sell", () => {
    const broker = makeUnit({ id: "corpse_broker", uid: "cb-1" });
    const board: (UnitInstance | null)[] = [broker, null];
    const sold = makeUnit({ uid: "sold-1" });
    const rng = createSeededRng(1);
    const result = applySellEffects(sold, board, rng);
    const b = atLevel(CORPSE_BROKER.sellBuff, 1);
    const updatedBroker = result.board.find(
      (u): u is UnitInstance => u !== null && u.uid === "cb-1",
    );
    expect(updatedBroker!.buffAtk).toBe(b.atk);
    expect(updatedBroker!.buffHp).toBe(b.hp);
  });

  it("does not buff when no corpse_broker", () => {
    const ally = makeUnit({ id: "rat", uid: "ally-1" });
    const board: (UnitInstance | null)[] = [ally, null];
    const sold = makeUnit({ uid: "sold-1" });
    const rng = createSeededRng(1);
    const result = applySellEffects(sold, board, rng);
    const unchanged = result.board.find((u): u is UnitInstance => u !== null && u.uid === "ally-1");
    expect(unchanged!.buffAtk).toBe(0);
    expect(unchanged!.buffHp).toBe(0);
  });
});

// ── market_vulture: 解体時に自身にバフ ──

describe("applySellEffects – market_vulture selfBuff", () => {
  it("buffs market_vulture itself on ally sell", () => {
    const vulture = makeUnit({ id: "market_vulture", uid: "mv-1" });
    const board: (UnitInstance | null)[] = [vulture, null];
    const sold = makeUnit({ uid: "sold-1" });
    const rng = createSeededRng(1);
    const result = applySellEffects(sold, board, rng);
    const b = atLevel(MARKET_VULTURE.selfBuff, 1);
    const updated = result.board.find((u): u is UnitInstance => u !== null && u.uid === "mv-1");
    expect(updated!.buffAtk).toBe(b.atk);
    expect(updated!.buffHp).toBe(b.hp);
  });

  it("returns shopBuff and applies selfBuff simultaneously", () => {
    const vulture = makeUnit({ id: "market_vulture", uid: "mv-1" });
    const board: (UnitInstance | null)[] = [vulture, null];
    const sold = makeUnit({ uid: "sold-1" });
    const rng = createSeededRng(1);
    const result = applySellEffects(sold, board, rng);
    const sb = atLevel(MARKET_VULTURE.shopBuff, 1);
    expect(result.shopBuff).toEqual({ atk: sb.atk, hp: sb.hp });
    const selfB = atLevel(MARKET_VULTURE.selfBuff, 1);
    const updated = result.board.find((u): u is UnitInstance => u !== null && u.uid === "mv-1");
    expect(updated!.buffAtk).toBe(selfB.atk);
    expect(updated!.buffHp).toBe(selfB.hp);
  });
});

// ── grave_worm: ボード上にいれば他ユニット解体時にバフ ──

describe("applySellEffects – grave_worm", () => {
  it("does not buff the worm itself (excludeIdx)", () => {
    const worm = makeUnit({ id: "grave_worm", uid: "worm-1" });
    const board: (UnitInstance | null)[] = [worm, null];
    const sold = makeUnit({ uid: "sold-1" });
    const rng = createSeededRng(1);
    const result = applySellEffects(sold, board, rng);
    const b = atLevel(GRAVE_WORM.sellBuff, 1);
    const updatedWorm = result.board.find(
      (u): u is UnitInstance => u !== null && u.uid === "worm-1",
    );
    expect(updatedWorm!.buffAtk).toBe(0);
    expect(updatedWorm!.buffHp).toBe(0);
    // バフの合計値も0（バフできる対象がいない）
    expect(b.atk + b.hp).toBeGreaterThan(0);
  });
});
