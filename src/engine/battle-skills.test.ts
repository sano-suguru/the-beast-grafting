import {
  runStartSkills,
  applyBeforeAttackSkills,
  applyCholeraBeforeAttack,
  applyOnHitSkills,
  applyEquipmentEffects,
} from "./battle-skills";
import { makeBattleUnit, makeContext } from "./test-helpers";
import type { BattleFrame } from "../shared/types";
import { segmentsToPlainText } from "./test-helpers";

const logText = (f: BattleFrame) => segmentsToPlainText(f.log.segments);

describe("runStartSkills – damage skills", () => {
  it("bat deals 1 damage to enemy front", () => {
    const bat = makeBattleUnit({ id: "bat", name: "蝙蝠", atk: 1, hp: 2 });
    const target = makeBattleUnit({ hp: 5 });
    const ctx = makeContext([bat], [target]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(target.hp).toBe(4);
  });

  it("inquisitor deals 1 damage to enemy front", () => {
    const inq = makeBattleUnit({ id: "inquisitor", name: "審問官", atk: 3, hp: 1 });
    const target = makeBattleUnit({ hp: 5 });
    const ctx = makeContext([inq], [target]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(target.hp).toBe(4);
  });

  it("Lv2 bat hits 2 random targets", () => {
    const bat = makeBattleUnit({ id: "bat", name: "蝙蝠", atk: 1, hp: 2, level: 2 });
    const t1 = makeBattleUnit({ hp: 5 });
    const t2 = makeBattleUnit({ hp: 5 });
    const ctx = makeContext([bat], [t1, t2]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(t1.hp).toBe(4);
    expect(t2.hp).toBe(4);
  });

  it("Lv3 bat hits 3 random targets", () => {
    const bat = makeBattleUnit({ id: "bat", name: "蝙蝠", atk: 1, hp: 2, level: 3 });
    const t1 = makeBattleUnit({ hp: 5 });
    const t2 = makeBattleUnit({ hp: 5 });
    const t3 = makeBattleUnit({ hp: 5 });
    const ctx = makeContext([bat], [t1, t2, t3]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(t1.hp).toBe(4);
    expect(t2.hp).toBe(4);
    expect(t3.hp).toBe(4);
  });

  it("Lv3 bat with fewer targets does not exceed available", () => {
    const bat = makeBattleUnit({ id: "bat", name: "蝙蝠", atk: 1, hp: 2, level: 3 });
    const t1 = makeBattleUnit({ hp: 5 });
    const ctx = makeContext([bat], [t1]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(t1.hp).toBe(4);
  });

  it("Lv2 inquisitor deals 2 damage to enemy front only", () => {
    const inq = makeBattleUnit({ id: "inquisitor", name: "審問官", atk: 3, hp: 1, level: 2 });
    const front = makeBattleUnit({ hp: 10 });
    const back = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([inq], [front, back]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(front.hp).toBe(8);
    expect(back.hp).toBe(10);
  });

  it("shrieking_throat deals 8 damage to enemy back", () => {
    const throat = makeBattleUnit({ id: "shrieking_throat", name: "叫喚する喉袋", atk: 8, hp: 4 });
    const front = makeBattleUnit({ hp: 10 });
    const back = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([throat], [front, back]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(front.hp).toBe(10);
    expect(back.hp).toBe(2);
  });

  it("shrieking_throat takes self-damage recoil", () => {
    const throat = makeBattleUnit({ id: "shrieking_throat", name: "叫喚する喉袋", atk: 8, hp: 10 });
    const enemy = makeBattleUnit({ hp: 20 });
    const ctx = makeContext([throat], [enemy]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(enemy.hp).toBe(12); // 20 - 8
    expect(throat.hp).toBe(7); // 10 - 3 (selfDamage at lv1)
  });
});

describe("runStartSkills – revenant buff", () => {
  it("buffs front 3 allies (excluding self) ATK+1 when last battle was LOSE", () => {
    const rev = makeBattleUnit({ id: "revenant", name: "復讐の亡霊", atk: 2, hp: 3 });
    const ally1 = makeBattleUnit({ atk: 3, hp: 3 });
    const ally2 = makeBattleUnit({ atk: 4, hp: 2 });
    const enemy = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([rev, ally1, ally2], [enemy], "LOSE");
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(rev.atk).toBe(2); // self not buffed (SAP Snail rule)
    expect(ally1.atk).toBe(4);
    expect(ally2.atk).toBe(5);
  });

  it("does nothing when last battle was WIN", () => {
    const rev = makeBattleUnit({ id: "revenant", name: "復讐の亡霊", atk: 2, hp: 3 });
    const ally = makeBattleUnit({ atk: 3, hp: 3 });
    const enemy = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([rev, ally], [enemy], "WIN");
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(rev.atk).toBe(2);
    expect(ally.atk).toBe(3);
    expect(ctx.frames).toHaveLength(0);
  });

  it("does nothing when lastBattleResult is null", () => {
    const rev = makeBattleUnit({ id: "revenant", name: "復讐の亡霊", atk: 2, hp: 3 });
    const ally = makeBattleUnit({ atk: 3, hp: 3 });
    const enemy = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([rev, ally], [enemy], null);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(rev.atk).toBe(2);
    expect(ctx.frames).toHaveLength(0);
  });

  it("generates a skill frame", () => {
    const rev = makeBattleUnit({ id: "revenant", name: "復讐の亡霊", atk: 2, hp: 3 });
    const ally = makeBattleUnit({ atk: 3, hp: 3 });
    const enemy = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([rev, ally], [enemy], "LOSE");
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(ctx.frames).toHaveLength(1);
    expect(ctx.frames[0]!.log.type).toBe("skill");
    expect(logText(ctx.frames[0]!)).toContain("復讐の亡霊");
  });

  it("buffs at most 3 allies even with more on board", () => {
    const rev = makeBattleUnit({ id: "revenant", name: "復讐の亡霊", atk: 2, hp: 3 });
    const a1 = makeBattleUnit({ atk: 1, hp: 1 });
    const a2 = makeBattleUnit({ atk: 1, hp: 1 });
    const a3 = makeBattleUnit({ atk: 1, hp: 1 });
    const a4 = makeBattleUnit({ atk: 1, hp: 1 });
    const enemy = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([rev, a1, a2, a3, a4], [enemy], "LOSE");
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(rev.atk).toBe(2); // self not buffed
    expect(a1.atk).toBe(2);
    expect(a2.atk).toBe(2);
    expect(a3.atk).toBe(2);
    expect(a4.atk).toBe(1); // 4th ally (5th unit), not buffed
  });

  it("buffs enemy-side allies when isPlayer=false", () => {
    const rev = makeBattleUnit({ id: "revenant", name: "復讐の亡霊", atk: 2, hp: 3 });
    const eAlly = makeBattleUnit({ atk: 3, hp: 3 });
    const player = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([player], [rev, eAlly], "LOSE");
    runStartSkills(ctx.eBoard, ctx.pBoard, false, ctx);
    expect(rev.atk).toBe(2); // self not buffed
    expect(eAlly.atk).toBe(4);
    expect(ctx.frames).toHaveLength(1);
    expect(logText(ctx.frames[0]!)).toContain("敵の");
  });
});

describe("runStartSkills – cholera infection", () => {
  it("cholera applies infection to a random enemy", () => {
    const cholera = makeBattleUnit({ id: "cholera", name: "コレラ", atk: 1, hp: 2, skillUses: 1 });
    const target = makeBattleUnit({ equip: null });
    const ctx = makeContext([cholera], [target], null, { next: () => 0 });
    applyCholeraBeforeAttack(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(target.equip).toBe("infection");
  });

  it("cholera logs overwrite when target has equipment", () => {
    const cholera = makeBattleUnit({ id: "cholera", name: "コレラ", atk: 1, hp: 2, skillUses: 1 });
    const target = makeBattleUnit({ equip: "iron", hp: 5 });
    const ctx = makeContext([cholera], [target], null, { next: () => 0 });
    applyCholeraBeforeAttack(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(target.equip).toBe("infection");
    expect(ctx.frames).toHaveLength(2);
    expect(logText(ctx.frames[0]!)).toContain("蝕まれた");
  });

  it("cholera does not log overwrite when target has no equipment", () => {
    const cholera = makeBattleUnit({ id: "cholera", name: "コレラ", atk: 1, hp: 2, skillUses: 1 });
    const target = makeBattleUnit({ equip: null, hp: 5 });
    const ctx = makeContext([cholera], [target], null, { next: () => 0 });
    applyCholeraBeforeAttack(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(ctx.frames).toHaveLength(1);
  });
});

describe("runStartSkills – brains and edge cases", () => {
  it("brains doubles start-of-battle skills", () => {
    const bat = makeBattleUnit({ id: "bat", name: "蝙蝠", atk: 1, hp: 2 });
    const brains = makeBattleUnit({ id: "brains", name: "双子脳", atk: 4, hp: 3 });
    const target = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([bat, brains], [target]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(target.hp).toBe(8);
  });

  it("brains does not double when not directly behind", () => {
    const bat = makeBattleUnit({ id: "bat", name: "蝙蝠", atk: 1, hp: 2 });
    const filler = makeBattleUnit({ hp: 3 });
    const brains = makeBattleUnit({ id: "brains", name: "双子脳", atk: 4, hp: 3 });
    const target = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([bat, filler, brains], [target]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(target.hp).toBe(9);
  });

  it("brains + devouring_graft: absorbs once, second invocation is no-op", () => {
    const fodder = makeBattleUnit({ id: "hound", name: "猟犬", atk: 2, hp: 3 });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const brains = makeBattleUnit({ id: "brains", name: "双子脳", atk: 4, hp: 3 });
    const ctx = makeContext([fodder, graft, brains], [makeBattleUnit({ hp: 10 })]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(graft.atk).toBe(3 + 2);
    expect(graft.hp).toBe(6 + 3);
    expect(ctx.pBoard).toHaveLength(2);
  });

  it("does nothing for units without start skills", () => {
    const plain = makeBattleUnit({ id: "hound", hp: 3 });
    const target = makeBattleUnit({ hp: 5 });
    const ctx = makeContext([plain], [target]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(target.hp).toBe(5);
  });

  it("does nothing when target array is empty", () => {
    const bat = makeBattleUnit({ id: "bat", hp: 2 });
    const ctx = makeContext([bat], []);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });
});

describe("applyBeforeAttackSkills", () => {
  it("parasite buffs itself +2/+2", () => {
    const front = makeBattleUnit({ atk: 3, hp: 3 });
    const parasite = makeBattleUnit({ id: "parasite", name: "寄生肉", atk: 1, hp: 2 });
    const ctx = makeContext([front, parasite], [makeBattleUnit()]);
    applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(parasite.atk).toBe(3);
    expect(parasite.hp).toBe(4);
  });

  it("eye deals 5 damage to a random enemy", () => {
    const front = makeBattleUnit({ atk: 3, hp: 3 });
    const eye = makeBattleUnit({ id: "eye", name: "大目玉", atk: 6, hp: 6, skillUses: 5 });
    const target = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([front, eye], [target], null, { next: () => 0 });
    applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(target.hp).toBe(5);
  });

  it("parasite at index 2 does not buff itself", () => {
    const front = makeBattleUnit({ atk: 3, hp: 3 });
    const middle = makeBattleUnit({ atk: 2, hp: 2 });
    const parasite = makeBattleUnit({ id: "parasite", name: "寄生肉", atk: 1, hp: 2 });
    const ctx = makeContext([front, middle, parasite], [makeBattleUnit()]);
    applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(parasite.atk).toBe(1);
    expect(parasite.hp).toBe(2);
  });

  it("multiple parasites each get buffed", () => {
    const front = makeBattleUnit({ atk: 3, hp: 3 });
    const p1 = makeBattleUnit({ id: "parasite", name: "寄生肉1", atk: 1, hp: 2, uid: "p1" });
    const p2 = makeBattleUnit({ id: "parasite", name: "寄生肉2", atk: 1, hp: 2, uid: "p2" });
    const ctx = makeContext([front, p1, p2], [makeBattleUnit()]);
    applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(p1.atk).toBe(3);
    expect(p1.hp).toBe(4);
    expect(p2.atk).toBe(1);
    expect(p2.hp).toBe(2);
  });

  it("does nothing with only one unit on board", () => {
    const front = makeBattleUnit({ atk: 3, hp: 3 });
    const ctx = makeContext([front], [makeBattleUnit()]);
    applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });

  it("machine buffs frontmost ally +1/+1 per trigger", () => {
    const front = makeBattleUnit({ atk: 5, hp: 5 });
    const machine = makeBattleUnit({ id: "machine", name: "輸血機械", skillUses: 3 });
    const ctx = makeContext([front, machine], [makeBattleUnit()]);
    applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(front.atk).toBe(6);
    expect(front.hp).toBe(6);
    expect(machine.skillUses).toBe(2);
  });

  it("machine stops after skillUses exhausted", () => {
    const front = makeBattleUnit({ atk: 5, hp: 5 });
    const machine = makeBattleUnit({ id: "machine", name: "輸血機械", skillUses: 0 });
    const ctx = makeContext([front, machine], [makeBattleUnit()]);
    applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(front.atk).toBe(5);
    expect(front.hp).toBe(5);
  });
});

describe("applyOnHitSkills", () => {
  it("templar buffs its own atk +1 when hit", () => {
    const templar = makeBattleUnit({ id: "templar", name: "聖堂騎士", atk: 4, hp: 3 });
    const ctx = makeContext([templar], []);
    applyOnHitSkills(templar, ctx.pBoard, true, ctx);
    expect(templar.atk).toBe(5);
  });
});

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
  it("infection adds 3 to incoming damage", () => {
    const p = makeBattleUnit({ equip: "infection", atk: 3, hp: 10 });
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
