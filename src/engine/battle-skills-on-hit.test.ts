import { applyOnHitSkills } from "./battle-skills-on-hit";
import { makeBattleUnit, makeContext, INERT_UNIT_ID } from "./test-helpers";
import {
  atLevel,
  FLAYED_SAINT,
  STITCHED_TWIN,
  HOWLING_GIANT,
  FLAGELLANT,
  TUMOR_GUARDIAN,
  AMNIOTIC_ARMOR,
} from "../shared/skill-params";

describe("applyOnHitSkills – templar", () => {
  it("templar buffs its own atk +1 when hit", () => {
    const templar = makeBattleUnit({ id: "templar", name: "聖堂騎士", atk: 4, hp: 3 });
    const ctx = makeContext([templar], []);
    applyOnHitSkills(templar, ctx.pBoard, true, ctx);
    expect(templar.atk).toBe(5);
  });
});

describe("applyOnHitSkills – flayed_saint", () => {
  it("buffs the friend behind when hit", () => {
    const saint = makeBattleUnit({ id: "flayed_saint", name: "聖者", atk: 2, hp: 5 });
    const ally = makeBattleUnit({ atk: 3, hp: 6 });
    const board = [saint, ally];
    const ctx = makeContext(board, []);
    applyOnHitSkills(saint, board, true, ctx);
    const b = atLevel(FLAYED_SAINT.buff, 1);
    expect(ally.atk).toBe(3 + b.atk);
    expect(ally.hp).toBe(6 + b.hp);
  });

  it("does nothing when no friend behind", () => {
    const saint = makeBattleUnit({ id: "flayed_saint", name: "聖者", atk: 2, hp: 5 });
    const board = [saint];
    const ctx = makeContext(board, []);
    applyOnHitSkills(saint, board, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });

  it("does nothing when friend behind is dead", () => {
    const saint = makeBattleUnit({ id: "flayed_saint", name: "聖者", atk: 2, hp: 5 });
    const dead = makeBattleUnit({ atk: 3, hp: 0 });
    const board = [saint, dead];
    const ctx = makeContext(board, []);
    applyOnHitSkills(saint, board, true, ctx);
    expect(dead.atk).toBe(3);
    expect(dead.hp).toBe(0);
  });
});

describe("applyOnHitSkills – stitched_twin", () => {
  it("buffs self atk on hit", () => {
    const twin = makeBattleUnit({ id: "stitched_twin", name: "継ぎ接ぎ", atk: 2, hp: 4 });
    const behind = makeBattleUnit({ atk: 3, hp: 10 });
    const board = [twin, behind];
    const ctx = makeContext(board, []);
    applyOnHitSkills(twin, board, true, ctx);
    const b = atLevel(STITCHED_TWIN.atkBuff, 1);
    expect(twin.atk).toBe(2 + b);
    expect(behind.hp).toBe(10);
  });

  it("does not crash when no unit behind", () => {
    const twin = makeBattleUnit({ id: "stitched_twin", name: "継ぎ接ぎ", atk: 2, hp: 4 });
    const board = [twin];
    const ctx = makeContext(board, []);
    applyOnHitSkills(twin, board, true, ctx);
    expect(twin.atk).toBe(2 + atLevel(STITCHED_TWIN.atkBuff, 1));
  });

  it("does not damage puppeteer behind", () => {
    const twin = makeBattleUnit({ id: "stitched_twin", name: "継ぎ接ぎ", atk: 2, hp: 4 });
    const puppet = makeBattleUnit({ id: "puppeteer", name: "操り糸", atk: 4, hp: 6 });
    const board = [twin, puppet];
    const ctx = makeContext(board, []);
    applyOnHitSkills(twin, board, true, ctx);
    const b = atLevel(STITCHED_TWIN.atkBuff, 1);
    expect(twin.atk).toBe(2 + b);
    expect(puppet.hp).toBe(6);
  });
});

describe("applyOnHitSkills – howling_giant", () => {
  it("buffs all allies atk on hit", () => {
    const wall = makeBattleUnit({ id: "howling_giant", name: "巨人", atk: 0, hp: 12 });
    const ally = makeBattleUnit({ atk: 3, hp: 5 });
    const board = [wall, ally];
    const ctx = makeContext(board, []);
    applyOnHitSkills(wall, board, true, ctx);
    const b = atLevel(HOWLING_GIANT.atkBuff, 1);
    expect(wall.atk).toBe(0 + b);
    expect(ally.atk).toBe(3 + b);
  });
});

describe("applyOnHitSkills – flagellant", () => {
  it("buffs unit behind on hit", () => {
    const flag = makeBattleUnit({ id: "flagellant", name: "苦行者", atk: 2, hp: 4 });
    const behind = makeBattleUnit({ atk: 3, hp: 5 });
    const board = [flag, behind];
    const ctx = makeContext(board, []);
    applyOnHitSkills(flag, board, true, ctx);
    const b = atLevel(FLAGELLANT.buff, 1);
    expect(behind.atk).toBe(3 + b.atk);
    expect(behind.hp).toBe(5 + b.hp);
  });

  it("does nothing when no unit behind", () => {
    const flag = makeBattleUnit({ id: "flagellant", name: "苦行者", atk: 2, hp: 4 });
    const board = [flag];
    const ctx = makeContext(board, []);
    applyOnHitSkills(flag, board, true, ctx);
    expect(flag.atk).toBe(2);
  });
});

describe("applyOnHitSkills – tumor_guardian", () => {
  it("deals damage to random enemy on hit", () => {
    const guardian = makeBattleUnit({ id: "tumor_guardian", name: "瘤の守り手", atk: 3, hp: 6 });
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 2, hp: 20 });
    const board = [guardian];
    const ctx = makeContext(board, [enemy]);
    applyOnHitSkills(guardian, board, true, ctx);
    const dmg = atLevel(TUMOR_GUARDIAN.damage, 1);
    expect(enemy.hp).toBe(20 - dmg);
    expect(ctx.frames).toHaveLength(1);
  });

  it("deals scaled damage at Lv2", () => {
    const guardian = makeBattleUnit({
      id: "tumor_guardian",
      name: "瘤の守り手",
      atk: 3,
      hp: 6,
      level: 2,
    });
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 2, hp: 20 });
    const board = [guardian];
    const ctx = makeContext(board, [enemy]);
    applyOnHitSkills(guardian, board, true, ctx);
    const dmg = atLevel(TUMOR_GUARDIAN.damage, 2);
    expect(enemy.hp).toBe(20 - dmg);
  });

  it("does nothing when enemy board is empty", () => {
    const guardian = makeBattleUnit({ id: "tumor_guardian", name: "瘤の守り手", atk: 3, hp: 6 });
    const board = [guardian];
    const ctx = makeContext(board, []);
    applyOnHitSkills(guardian, board, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });
});

describe("applyOnHitSkills – amniotic_armor", () => {
  it("grants corpse_wax on first hit with skillUses", () => {
    const uses = atLevel(AMNIOTIC_ARMOR.uses, 1);
    const armor = makeBattleUnit({
      id: "amniotic_armor",
      name: "羊膜の鎧",
      atk: 2,
      hp: 8,
      skillUses: uses,
    });
    const board = [armor];
    const ctx = makeContext(board, []);
    applyOnHitSkills(armor, board, true, ctx);
    expect(armor.equip).toBe("corpse_wax");
    expect(armor.skillUses).toBe(uses - 1);
    expect(ctx.frames).toHaveLength(1);
  });

  it("does not trigger when skillUses exhausted", () => {
    const armor = makeBattleUnit({
      id: "amniotic_armor",
      name: "羊膜の鎧",
      atk: 2,
      hp: 8,
      skillUses: 0,
    });
    const board = [armor];
    const ctx = makeContext(board, []);
    applyOnHitSkills(armor, board, true, ctx);
    expect(armor.equip).toBeNull();
    expect(ctx.frames).toHaveLength(0);
  });

  it("does not trigger when already equipped", () => {
    const uses = atLevel(AMNIOTIC_ARMOR.uses, 1);
    const armor = makeBattleUnit({
      id: "amniotic_armor",
      name: "羊膜の鎧",
      atk: 2,
      hp: 8,
      skillUses: uses,
      equip: "corpse_wax",
    });
    const board = [armor];
    const ctx = makeContext(board, []);
    applyOnHitSkills(armor, board, true, ctx);
    expect(armor.equip).toBe("corpse_wax");
    expect(armor.skillUses).toBe(uses);
  });
});
