import { runStartSkills, applyBeforeAttackSkills, applyAfterAttackSkills } from "./battle-skills";
import { runBattle } from "./battle";
import { makeBattleUnit, makeContext, INERT_UNIT_ID, makeEnemyTeam } from "./test-helpers";
import {
  atLevel,
  EYE,
  PALADIN,
  HOLY_FIRE,
  FAMINE_CORPSE,
  RELIC_SWORD,
  AMNIOTIC_ARMOR,
} from "../shared/skill-params";
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

  it("shrieking_throat deals 8 damage to enemy back at level 1", () => {
    const throat = makeBattleUnit({ id: "shrieking_throat", name: "叫喚する喉袋", atk: 7, hp: 4 });
    const front = makeBattleUnit({ hp: 10 });
    const back = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([throat], [front, back]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(front.hp).toBe(10);
    expect(back.hp).toBe(2);
  });

  it("shrieking_throat scales damage to 16 at level 2", () => {
    const throat = makeBattleUnit({
      id: "shrieking_throat",
      name: "叫喚する喉袋",
      atk: 7,
      hp: 10,
      level: 2,
    });
    const front = makeBattleUnit({ hp: 20 });
    const back = makeBattleUnit({ hp: 20 });
    const ctx = makeContext([throat], [front, back]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(front.hp).toBe(20);
    expect(back.hp).toBe(4);
    expect(throat.hp).toBe(10);
  });
});

// revenant is now a shop turn-start skill, not a battle SoB — tested in shop-effects-setup.test.ts

describe("runStartSkills – amniotic_armor", () => {
  it("buffs both allied and enemy HP at start of battle (SAP Armadillo)", () => {
    const armor = makeBattleUnit({ id: "amniotic_armor", name: "羊膜の鎧", atk: 4, hp: 8 });
    const ally = makeBattleUnit({ atk: 2, hp: 5 });
    const enemy = makeBattleUnit({ atk: 3, hp: 10 });
    const ctx = makeContext([armor, ally], [enemy]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    const bonus = atLevel(AMNIOTIC_ARMOR.hpBuff, 1);
    expect(armor.hp).toBe(8 + bonus);
    expect(ally.hp).toBe(5 + bonus);
    expect(enemy.hp).toBe(10 + bonus);
  });

  it("buffs all enemies (SAP Armadillo: affects both boards)", () => {
    const armor = makeBattleUnit({ id: "amniotic_armor", name: "羊膜の鎧", atk: 4, hp: 8 });
    const e1 = makeBattleUnit({ hp: 10 });
    const e2 = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([armor], [e1, e2]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    const bonus = atLevel(AMNIOTIC_ARMOR.hpBuff, 1);
    expect(e1.hp).toBe(10 + bonus);
    expect(e2.hp).toBe(10 + bonus);
  });

  it("scales buff with level", () => {
    const armor = makeBattleUnit({
      id: "amniotic_armor",
      name: "羊膜の鎧",
      atk: 4,
      hp: 8,
      level: 2,
    });
    const ally = makeBattleUnit({ atk: 2, hp: 5 });
    const ctx = makeContext([armor, ally], [makeBattleUnit({ hp: 10 })]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    const bonus = atLevel(AMNIOTIC_ARMOR.hpBuff, 2);
    expect(ally.hp).toBe(5 + bonus);
  });
});

describe("runStartSkills – brains and edge cases", () => {
  it("brains does NOT double start-of-battle skills (SAP compliant)", () => {
    const bat = makeBattleUnit({ id: "bat", name: "蝙蝠", atk: 1, hp: 2 });
    const brains = makeBattleUnit({ id: "brains", name: "双子脳", atk: 4, hp: 3 });
    const target = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([bat, brains], [target]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(target.hp).toBe(9);
  });

  it("brains does not affect ranged SoB skill when separated either", () => {
    const bat = makeBattleUnit({ id: "bat", name: "蝙蝠", atk: 1, hp: 2 });
    const filler = makeBattleUnit({ hp: 3 });
    const brains = makeBattleUnit({ id: "brains", name: "双子脳", atk: 4, hp: 3 });
    const target = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([bat, filler, brains], [target]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(target.hp).toBe(9);
  });

  it("brains + devouring_graft: devouring_graft runs once (no brains doubling on SoB)", () => {
    const fodder = makeBattleUnit({ id: "hound", name: "猟犬", atk: 2, hp: 3 });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const brains = makeBattleUnit({ id: "brains", name: "双子脳", atk: 4, hp: 3 });
    const ctx = makeContext([fodder, graft, brains], [makeBattleUnit({ hp: 10 })]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(graft.atk).toBe(3);
    expect(graft.hp).toBe(6);
    expect(ctx.pBoard).toHaveLength(2);
  });

  it("does nothing for units without start skills", () => {
    const plain = makeBattleUnit({ id: "hound", hp: 3 });
    const target = makeBattleUnit({ hp: 5 });
    const ctx = makeContext([plain], [target]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(target.hp).toBe(5);
  });

  it("brains + evangelist: HP-percent shred runs only once on SoB (SAP compliant)", () => {
    const ev = makeBattleUnit({ id: "evangelist", name: "伝道師", atk: 1, hp: 8, level: 1 });
    const brains = makeBattleUnit({ id: "brains", name: "双子脳", atk: 4, hp: 3 });
    const target = makeBattleUnit({ hp: 100 });
    const ctx = makeContext([ev, brains], [target]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    // Lv1=33%: 100 → floor(100*0.33)=33 damage → 67
    expect(target.hp).toBe(67);
  });

  it("does nothing when target array is empty", () => {
    const bat = makeBattleUnit({ id: "bat", hp: 2 });
    const ctx = makeContext([bat], []);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });
});

describe("applyBeforeAttackSkills", () => {
  // parasite is now a summon-reaction skill, not before-attack — tested in battle-deaths.test.ts and shop-effects.test.ts

  it("eye deals 5 damage to a random enemy", () => {
    const front = makeBattleUnit({ atk: 3, hp: 3 });
    const eye = makeBattleUnit({
      id: "eye",
      name: "大目玉",
      atk: 6,
      hp: 6,
      skillUses: atLevel(EYE.uses, 1),
    });
    const target = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([front, eye], [target], null, { next: () => 0 });
    applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(target.hp).toBe(5);
  });

  it("does nothing with only one unit on board", () => {
    const front = makeBattleUnit({ atk: 3, hp: 3 });
    const ctx = makeContext([front], [makeBattleUnit()]);
    applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(ctx.frames).toHaveLength(0);
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

describe("runStartSkills – famine_corpse", () => {
  it("deals damage to lowest HP enemy", () => {
    const famine = makeBattleUnit({ id: "famine_corpse", name: "蝗", atk: 3, hp: 3 });
    const highHp = makeBattleUnit({ hp: 20, atk: 2 });
    const lowHp = makeBattleUnit({ hp: 6, atk: 2 });
    const ctx = makeContext([famine], [highHp, lowHp]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(lowHp.hp).toBe(6 - FAMINE_CORPSE.damage);
    expect(highHp.hp).toBe(20);
  });

  it("targets lowest HP among alive enemies", () => {
    const famine = makeBattleUnit({ id: "famine_corpse", name: "蝗", atk: 3, hp: 3 });
    const tough = makeBattleUnit({ id: INERT_UNIT_ID, hp: 30, atk: 2 });
    const fragile = makeBattleUnit({ id: INERT_UNIT_ID, hp: 1, atk: 2 });
    const ctx = makeContext([famine], [tough, fragile]);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(fragile.hp).toBe(1 - FAMINE_CORPSE.damage);
    expect(tough.hp).toBe(30);
  });

  it("does nothing when enemy board is empty", () => {
    const famine = makeBattleUnit({ id: "famine_corpse", name: "蝗", atk: 3, hp: 3 });
    const ctx = makeContext([famine], []);
    runStartSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(ctx.frames.filter((f) => f.log.type === "skill")).toHaveLength(0);
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

describe("corroding_mold – start skill", () => {
  it("buffs the unit in front at start of battle", () => {
    const front = makeBattleUnit({ id: INERT_UNIT_ID, atk: 3, hp: 5 });
    const mold = makeBattleUnit({ id: "corroding_mold", name: "侵蝕する黴", atk: 2, hp: 3 });
    const board = [front, mold];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    // 50% of ATK 2 = 1 → front gets +1 ATK only (no HP buff, %ATK skill)
    expect(front.atk).toBe(3 + 1);
    expect(front.hp).toBe(5);
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

describe("needleshell_worm – 攻撃後", () => {
  it("攻撃後に後方1体に1ダメージ (L1)", () => {
    const worm = makeBattleUnit({ id: "needleshell_worm", name: "針殻の蟲", atk: 3, hp: 7 });
    const behind = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 5 });
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 10 });
    const board = [worm, behind];
    const ctx = makeContext(board, [enemy]);
    applyAfterAttackSkills(worm, board, [enemy], true, ctx);
    expect(behind.hp).toBe(4);
  });

  it("L2では最も近い後方味方に1ダメージ×2回", () => {
    const worm = makeBattleUnit({
      id: "needleshell_worm",
      name: "針殻の蟲",
      atk: 3,
      hp: 7,
      level: 2,
    });
    const b1 = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 5 });
    const b2 = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 5 });
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 10 });
    const board = [worm, b1, b2];
    const ctx = makeContext(board, [enemy]);
    applyAfterAttackSkills(worm, board, [enemy], true, ctx);
    expect(b1.hp).toBe(3); // 最も近いb1が2回被弾
    expect(b2.hp).toBe(5); // b2は被弾しない
  });

  it("L2: b1が1回目で死んだ場合b2にリターゲット", () => {
    const worm = makeBattleUnit({
      id: "needleshell_worm",
      name: "針殻の蟲",
      atk: 3,
      hp: 7,
      level: 2,
    });
    const b1 = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 1 }); // 1撃で死ぬ
    const b2 = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 5 });
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 10 });
    const board = [worm, b1, b2];
    const ctx = makeContext(board, [enemy]);
    applyAfterAttackSkills(worm, board, [enemy], true, ctx);
    expect(b1.hp).toBe(0); // b1は死亡(0以下)
    expect(b2.hp).toBe(4); // リターゲットでb2が1ダメ
  });

  it("L2: b1が生存し2回被弾した場合、2フレーム pushされる（各1ダメ）", () => {
    const worm = makeBattleUnit({
      id: "needleshell_worm",
      name: "針殻の蟲",
      atk: 3,
      hp: 7,
      level: 2,
    });
    const b1 = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 5 });
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 10 });
    const board = [worm, b1];
    const ctx = makeContext(board, [enemy]);
    const framesBefore = ctx.frames.length;
    applyAfterAttackSkills(worm, board, [enemy], true, ctx);
    const addedFrames = ctx.frames.length - framesBefore;
    expect(addedFrames).toBe(2);
    expect(b1.hp).toBe(3);
    const lastFrame = ctx.frames[ctx.frames.length - 1]!;
    const b1Action = lastFrame.actions[b1.uid];
    expect(b1Action?.type).toBe("damage");
    expect(b1Action?.damage).toBe(1);
  });

  it("後方の味方が被弾スキル持ちの場合チェーン発動", () => {
    const worm = makeBattleUnit({ id: "needleshell_worm", name: "針殻の蟲", atk: 3, hp: 7 });
    const twin = makeBattleUnit({
      id: "stitched_twin",
      name: "継ぎ接ぎの双子",
      atk: 1,
      hp: 10,
    });
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 10 });
    const board = [worm, twin];
    const ctx = makeContext(board, [enemy]);
    applyAfterAttackSkills(worm, board, [enemy], true, ctx);
    expect(twin.hp).toBe(9);
    expect(twin.atk).toBeGreaterThan(1); // stitched_twin 被弾スキルが発動
  });

  it("後方に味方がいない場合は何も起きない", () => {
    const worm = makeBattleUnit({ id: "needleshell_worm", name: "針殻の蟲", atk: 3, hp: 7 });
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 10 });
    const board = [worm];
    const ctx = makeContext(board, [enemy]);
    const framesBefore = ctx.frames.length;
    applyAfterAttackSkills(worm, board, [enemy], true, ctx);
    expect(ctx.frames.length).toBe(framesBefore);
  });
});
