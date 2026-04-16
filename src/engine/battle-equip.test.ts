import { applyEquipmentEffects } from "./battle-skills";
import { makeBattleUnit, makeContext } from "./test-helpers";

describe("applyEquipmentEffects – defensive", () => {
  it("iron reduces damage by 2 (min 1)", () => {
    const p = makeBattleUnit({ equip: "iron", atk: 3, hp: 5 });
    const e = makeBattleUnit({ atk: 4, hp: 5 });
    const ctx = makeContext([p], [e]);
    const { pDmg, eDmg } = applyEquipmentEffects(p, e, ctx);
    expect(pDmg).toBe(2);
    expect(eDmg).toBe(3);
  });

  it("iron clamps damage to minimum 1", () => {
    const p = makeBattleUnit({ equip: "iron", hp: 5 });
    const e = makeBattleUnit({ atk: 1, hp: 5 });
    const ctx = makeContext([p], [e]);
    const { pDmg } = applyEquipmentEffects(p, e, ctx);
    expect(pDmg).toBe(2);
  });

  it("corpse_wax blocks up to 20 damage and is consumed", () => {
    const p = makeBattleUnit({ equip: "corpse_wax", atk: 3, hp: 5 });
    const e = makeBattleUnit({ atk: 10, hp: 5 });
    const ctx = makeContext([p], [e]);
    const { pDmg } = applyEquipmentEffects(p, e, ctx);
    expect(pDmg).toBe(0);
    expect(p.equip).toBeNull();
  });

  it("numbness reduces damage by 7 fixed", () => {
    const p = makeBattleUnit({ equip: "numbness", atk: 3, hp: 10, equipUses: 2 });
    const e = makeBattleUnit({ atk: 10, hp: 10 });
    const ctx = makeContext([p], [e]);
    const { pDmg } = applyEquipmentEffects(p, e, ctx);
    expect(pDmg).toBe(3);
  });
});

describe("applyEquipmentEffects – offensive and misc", () => {
  it("infection Lv1 adds 1 to incoming damage", () => {
    const p = makeBattleUnit({ equip: "infection", infectionLevel: 1, atk: 3, hp: 10 });
    const e = makeBattleUnit({ atk: 4, hp: 10 });
    const ctx = makeContext([p], [e]);
    const { pDmg } = applyEquipmentEffects(p, e, ctx);
    expect(pDmg).toBe(5);
  });

  it("infection Lv3 adds 3 to incoming damage", () => {
    const p = makeBattleUnit({ equip: "infection", infectionLevel: 3, atk: 3, hp: 10 });
    const e = makeBattleUnit({ atk: 4, hp: 10 });
    const ctx = makeContext([p], [e]);
    const { pDmg } = applyEquipmentEffects(p, e, ctx);
    expect(pDmg).toBe(7);
  });

  it("no equip returns raw atk values", () => {
    const p = makeBattleUnit({ atk: 5, hp: 10 });
    const e = makeBattleUnit({ atk: 3, hp: 10 });
    const ctx = makeContext([p], [e]);
    const { pDmg, eDmg } = applyEquipmentEffects(p, e, ctx);
    expect(pDmg).toBe(3);
    expect(eDmg).toBe(5);
  });

  it("berserk adds 4 to outgoing damage", () => {
    const p = makeBattleUnit({ equip: "berserk", atk: 3, hp: 10 });
    const e = makeBattleUnit({ atk: 2, hp: 10 });
    const ctx = makeContext([p], [e]);
    const { eDmg, pDmg } = applyEquipmentEffects(p, e, ctx);
    expect(eDmg).toBe(6);
    expect(pDmg).toBe(2);
  });

  it("berserk on enemy adds 4 to enemy outgoing damage", () => {
    const p = makeBattleUnit({ atk: 3, hp: 10 });
    const e = makeBattleUnit({ equip: "berserk", atk: 2, hp: 10 });
    const ctx = makeContext([p], [e]);
    const { pDmg, eDmg } = applyEquipmentEffects(p, e, ctx);
    expect(pDmg).toBe(5);
    expect(eDmg).toBe(3);
  });

  it("berserk damage is reduced by iron", () => {
    const p = makeBattleUnit({ equip: "berserk", atk: 3, hp: 10 });
    const e = makeBattleUnit({ equip: "iron", atk: 2, hp: 10 });
    const ctx = makeContext([p], [e]);
    const { eDmg } = applyEquipmentEffects(p, e, ctx);
    expect(eDmg).toBe(4);
  });
});

describe("applyEquipmentEffects – numbness exhaustion", () => {
  it("numbness equip is removed after last use (equipUses: 1)", () => {
    const p = makeBattleUnit({ equip: "numbness", atk: 3, hp: 10, equipUses: 1 });
    const e = makeBattleUnit({ atk: 10, hp: 10 });
    const ctx = makeContext([p], [e]);
    applyEquipmentEffects(p, e, ctx);
    expect(p.equip).toBeNull();
    expect(p.equipUses).toBe(0);
  });

  it("numbness equip persists with equipUses: 2", () => {
    const p = makeBattleUnit({ equip: "numbness", atk: 3, hp: 10, equipUses: 2 });
    const e = makeBattleUnit({ atk: 10, hp: 10 });
    const ctx = makeContext([p], [e]);
    applyEquipmentEffects(p, e, ctx);
    expect(p.equip).toBe("numbness");
    expect(p.equipUses).toBe(1);
  });

  it("numbness with equipUses: 0 does not reduce damage", () => {
    const p = makeBattleUnit({ equip: "numbness", atk: 3, hp: 10, equipUses: 0 });
    const e = makeBattleUnit({ atk: 8, hp: 10 });
    const ctx = makeContext([p], [e]);
    const { pDmg } = applyEquipmentEffects(p, e, ctx);
    expect(pDmg).toBe(8);
    expect(p.equip).toBe("numbness");
    expect(p.equipUses).toBe(0);
  });
});

describe("applyEquipmentEffects – side effects and frames", () => {
  it("corpse_wax sets equip to null after blocking", () => {
    const p = makeBattleUnit({ equip: "corpse_wax", atk: 3, hp: 10 });
    const e = makeBattleUnit({ atk: 5, hp: 10 });
    const ctx = makeContext([p], [e]);
    applyEquipmentEffects(p, e, ctx);
    expect(p.equip).toBeNull();
  });

  it("iron generates a defend frame", () => {
    const p = makeBattleUnit({ equip: "iron", atk: 3, hp: 10 });
    const e = makeBattleUnit({ atk: 6, hp: 10 });
    const ctx = makeContext([p], [e]);
    applyEquipmentEffects(p, e, ctx);
    expect(ctx.frames.length).toBeGreaterThanOrEqual(1);
    expect(ctx.frames.some((f) => f.log.type === "defend")).toBe(true);
  });

  it("berserk generates a skill frame", () => {
    const p = makeBattleUnit({ equip: "berserk", atk: 3, hp: 10 });
    const e = makeBattleUnit({ atk: 2, hp: 10 });
    const ctx = makeContext([p], [e]);
    applyEquipmentEffects(p, e, ctx);
    expect(ctx.frames.length).toBeGreaterThanOrEqual(1);
    expect(ctx.frames.some((f) => f.log.type === "skill")).toBe(true);
  });
});
