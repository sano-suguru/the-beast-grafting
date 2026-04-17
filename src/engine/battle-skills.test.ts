import { runStartSkills, applyBeforeAttackSkills, applyCholeraBeforeAttack } from "./battle-skills";
import { runDeploySkills } from "./battle-skills-init";
import { runBattle } from "./battle";
import { spawnTokenAndNotify } from "./battle-spawn";
import { makeBattleUnit, makeContext, INERT_UNIT_ID, makeEnemyTeam } from "./test-helpers";
import type { BattleFrame } from "../shared/types";
import { segmentsToPlainText } from "./test-helpers";
import {
  atLevel,
  CATACOMB_RAT,
  PLAGUE_BELL,
  PALADIN,
  HOLY_FIRE,
  FAMINE_CORPSE,
  RELIC_SWORD,
  FLESH_GRANULATION,
} from "../shared/skill-params";
import { BLOOD_FONT } from "../shared/skill-params-shop";

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
    const inq = makeBattleUnit({ id: "church_inquisitor", name: "審問官", atk: 3, hp: 1 });
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
    const inq = makeBattleUnit({
      id: "church_inquisitor",
      name: "審問官",
      atk: 3,
      hp: 1,
      level: 2,
    });
    const front = makeBattleUnit({ hp: 10 });
    const back = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([inq], [front, back]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(front.hp).toBe(8);
    expect(back.hp).toBe(10);
  });

  it("shrieking_throat deals 6 damage to enemy back", () => {
    const throat = makeBattleUnit({ id: "shrieking_throat", name: "叫喚する喉袋", atk: 7, hp: 4 });
    const front = makeBattleUnit({ hp: 10 });
    const back = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([throat], [front, back]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(front.hp).toBe(10);
    expect(back.hp).toBe(4);
  });

  it("shrieking_throat takes self-damage recoil", () => {
    const throat = makeBattleUnit({ id: "shrieking_throat", name: "叫喚する喉袋", atk: 7, hp: 10 });
    const enemy = makeBattleUnit({ hp: 20 });
    const ctx = makeContext([throat], [enemy]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(enemy.hp).toBe(14); // 20 - 6
    expect(throat.hp).toBe(7); // 10 - 3 (selfDamage at lv1)
  });
});

describe("runStartSkills – revenant buff", () => {
  it("doubles buff when last battle was LOSE", () => {
    const rev = makeBattleUnit({ id: "revenant", name: "復讐の亡霊", atk: 2, hp: 3 });
    const ally1 = makeBattleUnit({ atk: 3, hp: 3 });
    const ally2 = makeBattleUnit({ atk: 4, hp: 2 });
    const enemy = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([rev, ally1, ally2], [enemy], "LOSE");
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(rev.atk).toBe(2); // self not buffed (SAP Snail rule)
    expect(ally1.atk).toBe(5); // +2 (baseBuff 1 × lossBonusMult 2)
    expect(ally2.atk).toBe(6);
  });

  it("applies base buff when last battle was WIN", () => {
    const rev = makeBattleUnit({ id: "revenant", name: "復讐の亡霊", atk: 2, hp: 3 });
    const ally = makeBattleUnit({ atk: 3, hp: 3 });
    const enemy = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([rev, ally], [enemy], "WIN");
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(rev.atk).toBe(2);
    expect(ally.atk).toBe(4); // +1 (baseBuff)
    expect(ctx.frames).toHaveLength(1);
  });

  it("applies base buff when lastBattleResult is null", () => {
    const rev = makeBattleUnit({ id: "revenant", name: "復讐の亡霊", atk: 2, hp: 3 });
    const ally = makeBattleUnit({ atk: 3, hp: 3 });
    const enemy = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([rev, ally], [enemy], null);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(rev.atk).toBe(2);
    expect(ally.atk).toBe(4); // +1 (baseBuff)
    expect(ctx.frames).toHaveLength(1);
  });

  it("generates a skill frame with loss log", () => {
    const rev = makeBattleUnit({ id: "revenant", name: "復讐の亡霊", atk: 2, hp: 3 });
    const ally = makeBattleUnit({ atk: 3, hp: 3 });
    const enemy = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([rev, ally], [enemy], "LOSE");
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(ctx.frames).toHaveLength(1);
    expect(ctx.frames[0]!.log.type).toBe("skill");
    expect(logText(ctx.frames[0]!)).toContain("激怒");
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
    expect(a1.atk).toBe(3); // +2 (doubled on LOSE)
    expect(a2.atk).toBe(3);
    expect(a3.atk).toBe(3);
    expect(a4.atk).toBe(1); // 4th ally (5th unit), not buffed
  });

  it("buffs enemy-side allies when isPlayer=false", () => {
    const rev = makeBattleUnit({ id: "revenant", name: "復讐の亡霊", atk: 2, hp: 3 });
    const eAlly = makeBattleUnit({ atk: 3, hp: 3 });
    const player = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([player], [rev, eAlly], "LOSE");
    runStartSkills(ctx.eBoard, ctx.pBoard, false, ctx);
    expect(rev.atk).toBe(2); // self not buffed
    expect(eAlly.atk).toBe(5); // +2 (doubled on LOSE)
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
    const target = makeBattleUnit({ equip: "iron_plate", hp: 5 });
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
    expect(graft.atk).toBe(3 + Math.floor(2 * 0.7));
    expect(graft.hp).toBe(6 + Math.floor(3 * 0.7));
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

  it("eye deals 4 damage to a random enemy", () => {
    const front = makeBattleUnit({ atk: 3, hp: 3 });
    const eye = makeBattleUnit({ id: "eye", name: "大目玉", atk: 6, hp: 6, skillUses: 4 });
    const target = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([front, eye], [target], null, { next: () => 0 });
    applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(target.hp).toBe(6);
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

describe("runStartSkills – catacomb_rat", () => {
  it("deals tier×mult damage to a random enemy", () => {
    const rat = makeBattleUnit({ id: "catacomb_rat", name: "聖骨齧り", atk: 2, hp: 3, tier: 3 });
    const enemy = makeBattleUnit({ hp: 20 });
    const ctx = makeContext([rat], [enemy], null, { next: () => 0 });
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    const dmg = 3 * atLevel(CATACOMB_RAT.tierMult, 1);
    expect(enemy.hp).toBe(20 - dmg);
  });

  it("does nothing when enemy board is empty", () => {
    const rat = makeBattleUnit({ id: "catacomb_rat", name: "聖骨齧り", atk: 2, hp: 3, tier: 2 });
    const ctx = makeContext([rat], []);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(ctx.frames.filter((f) => f.log.type === "skill")).toHaveLength(0);
  });
});

describe("applyBeforeAttackSkills – plague_bell", () => {
  it("deals AoE damage to all enemies from SUPPORT_IDX", () => {
    const front = makeBattleUnit({ atk: 5, hp: 10 });
    const bell = makeBattleUnit({
      id: "plague_bell",
      name: "疫病の鐘撞き",
      atk: 3,
      hp: 7,
      skillUses: 3,
    });
    const e1 = makeBattleUnit({ hp: 10 });
    const e2 = makeBattleUnit({ hp: 8 });
    const ctx = makeContext([front, bell], [e1, e2]);
    applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    const dmg = atLevel(PLAGUE_BELL.damage, 1);
    expect(e1.hp).toBe(10 - dmg);
    expect(e2.hp).toBe(8 - dmg);
    expect(bell.skillUses).toBe(2);
  });

  it("does not trigger when skillUses is 0", () => {
    const front = makeBattleUnit({ atk: 5, hp: 10 });
    const bell = makeBattleUnit({
      id: "plague_bell",
      name: "疫病の鐘撞き",
      atk: 3,
      hp: 7,
      skillUses: 0,
    });
    const e1 = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([front, bell], [e1]);
    applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(e1.hp).toBe(10);
  });

  it("does not trigger when not at SUPPORT_IDX", () => {
    const front = makeBattleUnit({ atk: 5, hp: 10 });
    const middle = makeBattleUnit({ atk: 2, hp: 2 });
    const bell = makeBattleUnit({
      id: "plague_bell",
      name: "疫病の鐘撞き",
      atk: 3,
      hp: 7,
      skillUses: 3,
    });
    const e1 = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([front, middle, bell], [e1]);
    applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(e1.hp).toBe(10);
  });
});

describe("runStartSkills – paladin", () => {
  it("buffs all allies HP", () => {
    const pal = makeBattleUnit({ id: "paladin", name: "聖騎士", atk: 3, hp: 5 });
    const ally = makeBattleUnit({ atk: 2, hp: 4 });
    const ctx = makeContext([pal, ally], [makeBattleUnit({ hp: 10 })]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    const hpBuff = atLevel(PALADIN.hpBuff, 1);
    expect(pal.hp).toBe(5 + hpBuff);
    expect(ally.hp).toBe(4 + hpBuff);
  });
});

describe("runStartSkills – holy_fire", () => {
  it("damages the enemy with highest HP", () => {
    const fire = makeBattleUnit({ id: "holy_fire", name: "聖火", atk: 6, hp: 4 });
    const weakEnemy = makeBattleUnit({ hp: 5 });
    const strongEnemy = makeBattleUnit({ hp: 20 });
    const ctx = makeContext([fire], [weakEnemy, strongEnemy]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    const dmg = atLevel(HOLY_FIRE.damage, 1);
    expect(strongEnemy.hp).toBe(20 - dmg);
    expect(weakEnemy.hp).toBe(5);
  });

  it("does nothing when enemy board is empty", () => {
    const fire = makeBattleUnit({ id: "holy_fire", name: "聖火", atk: 6, hp: 4 });
    const ctx = makeContext([fire], []);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(ctx.frames.filter((f) => f.log.type === "skill")).toHaveLength(0);
  });
});

describe("applyBeforeAttackSkills – famine_corpse", () => {
  it("debuffs enemy front unit atk by fixed skill parameter", () => {
    const front = makeBattleUnit({ atk: 5, hp: 10 });
    const famine = makeBattleUnit({ id: "famine_corpse", name: "蝗", atk: 3, hp: 3 });
    const ctx = makeContext([front, famine], [makeBattleUnit({ hp: 10, atk: 4 })]);
    applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    const debuff = atLevel(FAMINE_CORPSE.debuff, 1);
    expect(front.atk).toBe(5);
    expect(famine.atk).toBe(3);
    expect(ctx.eBoard[0]!.atk).toBe(Math.max(1, 4 - debuff));
  });

  it("floors atk at 1", () => {
    const front = makeBattleUnit({ atk: 5, hp: 10 });
    const famine = makeBattleUnit({ id: "famine_corpse", name: "蝗", atk: 3, hp: 3 });
    const weakEnemy = makeBattleUnit({ hp: 10, atk: 1 });
    const ctx = makeContext([front, famine], [weakEnemy]);
    applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(weakEnemy.atk).toBe(1);
  });

  it("debuff does not scale with ATK buffs", () => {
    const front = makeBattleUnit({ atk: 5, hp: 10 });
    const famine = makeBattleUnit({ id: "famine_corpse", name: "蝗", atk: 20, hp: 3 });
    const enemy = makeBattleUnit({ hp: 10, atk: 10 });
    const ctx = makeContext([front, famine], [enemy]);
    applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    const debuff = atLevel(FAMINE_CORPSE.debuff, 1);
    // ATK 20 でも debuff は固定パラメータ (level 1 = 2)
    expect(enemy.atk).toBe(10 - debuff);
  });
});

describe("applyBeforeAttackSkills – relic_sword", () => {
  it("buffs front ally atk", () => {
    const front = makeBattleUnit({ atk: 5, hp: 10 });
    const sword = makeBattleUnit({ id: "relic_sword", name: "聖骨の刃", atk: 5, hp: 3 });
    const ctx = makeContext([front, sword], [makeBattleUnit({ hp: 10 })]);
    applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    const buff = atLevel(RELIC_SWORD.atkBuff, 1);
    expect(front.atk).toBe(5 + buff);
  });
});

describe("runDeploySkills – blood_font buffs lowest HP ally", () => {
  it("buffs the ally with the lowest HP", () => {
    const font = makeBattleUnit({ id: "blood_font", name: "血獣", atk: 1, hp: 5 });
    const weak = makeBattleUnit({ atk: 2, hp: 2 });
    const strong = makeBattleUnit({ atk: 2, hp: 10 });
    const ctx = makeContext([font, weak, strong], []);
    runDeploySkills(ctx.pBoard, true, ctx);
    const hpBuff = atLevel(BLOOD_FONT.hpBuff, 1);
    expect(weak.hp).toBe(2 + hpBuff);
    expect(strong.hp).toBe(10);
  });

  it("does not buff self", () => {
    const font = makeBattleUnit({ id: "blood_font", name: "血獣", atk: 1, hp: 1 });
    const ally = makeBattleUnit({ atk: 2, hp: 5 });
    const ctx = makeContext([font, ally], []);
    runDeploySkills(ctx.pBoard, true, ctx);
    const hpBuff = atLevel(BLOOD_FONT.hpBuff, 1);
    expect(font.hp).toBe(1);
    expect(ally.hp).toBe(5 + hpBuff);
  });

  it("does not fire when blood_font is alone", () => {
    const font = makeBattleUnit({ id: "blood_font", name: "血獣", atk: 1, hp: 5 });
    const ctx = makeContext([font], []);
    runDeploySkills(ctx.pBoard, true, ctx);
    expect(font.hp).toBe(5);
    expect(ctx.frames).toHaveLength(0);
  });
});

describe("flesh_granulation – on ally summon", () => {
  it("buffs self when a token is spawned", () => {
    const fg = makeBattleUnit({ id: "flesh_granulation", name: "増殖する肉芽", atk: 2, hp: 3 });
    const board = [fg];
    const ctx = makeContext(board, []);
    spawnTokenAndNotify({
      board,
      idx: 1,
      name: "肉塊",
      atk: 1,
      hp: 1,
      isChurch: false,
      segments: () => ["召喚"],
      isPlayer: true,
      ctx,
    });
    const b = atLevel(FLESH_GRANULATION.buff, 1);
    expect(fg.atk).toBe(2 + b.atk);
    expect(fg.hp).toBe(3 + b.hp);
  });

  it("does not buff when dead", () => {
    const fg = makeBattleUnit({ id: "flesh_granulation", name: "増殖する肉芽", atk: 2, hp: 0 });
    const board = [fg];
    const ctx = makeContext(board, []);
    spawnTokenAndNotify({
      board,
      idx: 1,
      name: "肉塊",
      atk: 1,
      hp: 1,
      isChurch: false,
      segments: () => ["召喚"],
      isPlayer: true,
      ctx,
    });
    expect(fg.atk).toBe(2);
  });
});

describe("corroding_mold – start skill", () => {
  it("buffs the unit in front at start of battle", () => {
    const front = makeBattleUnit({ id: INERT_UNIT_ID, atk: 3, hp: 5 });
    const mold = makeBattleUnit({ id: "corroding_mold", name: "侵蝕する黴", atk: 2, hp: 3 });
    const board = [front, mold];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    expect(front.atk).toBe(3 + 1);
    expect(front.hp).toBe(5 + 1);
  });

  it("does nothing when mold is at front (no unit ahead)", () => {
    const mold = makeBattleUnit({ id: "corroding_mold", name: "侵蝕する黴", atk: 2, hp: 3 });
    const board = [mold];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    expect(mold.atk).toBe(2);
    expect(mold.hp).toBe(3);
  });

  it("fires only once per battle, not every clash", () => {
    const front = makeBattleUnit({ id: INERT_UNIT_ID, atk: 3, hp: 200 });
    const mold = makeBattleUnit({ id: "corroding_mold", name: "侵蝕する黴", atk: 2, hp: 200 });
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 200 });
    const ctx = makeContext([front, mold], [enemy]);
    runBattle(ctx, makeEnemyTeam([]), 1);
    const moldFrames = ctx.frames.filter(
      (f) =>
        f.log.type === "skill" &&
        f.log.segments.some((s) => typeof s !== "string" && s.text === "侵蝕する黴"),
    );
    expect(moldFrames).toHaveLength(1);
  });
});
