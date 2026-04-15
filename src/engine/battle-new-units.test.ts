import type { BattleUnit, BattleContext } from "./battle-context";
import type { UnitId } from "../shared/types";
import { processAvenge, incrementAvengeCounters } from "./battle-avenge";
import { resolveDeaths } from "./battle-deaths";
import { handleBeelzebubSpawns } from "./battle-deaths-effects-reactions";
import {
  handleCrawlingCordBuff,
  handleInsatiableMawBuff,
} from "./battle-deaths-effects-ally-reactions";
import { getDeathHandler } from "./battle-deaths-handlers";
import { applyOnHitSkills } from "./battle-skills-on-hit";
import { processKnockoutEffects } from "./battle-skills-combat";
import { spawnTokenAndNotify } from "./battle-spawn";
import {
  makeBattleUnit,
  makeContext,
  makeEnemyTeam,
  segmentsToPlainText,
  INERT_UNIT_ID,
} from "./test-helpers";
import { runStartSkills, applyBeforeAttackSkills } from "./battle-skills";
import { runDeploySkills } from "./battle-skills-init";
import { runBattle } from "./battle";
import { invariant } from "../shared/invariant";
import { MAX_BOARD_SIZE } from "./constants";
import {
  atLevel,
  CHARNEL_PIT,
  HANGED_MAN,
  SERAPH,
  FLAYED_SAINT,
  RAT,
  CATHEDRAL,
  CROW,
  SIN_EATER,
  ORGAN_GRINDER,
  RISEN_POPE,
  STITCHED_TWIN,
  FLAGELLANT,
  HOWLING_GIANT,
  BUDDING_HYDRA,
  BLOOD_FONT,
  CATACOMB_RAT,
  PLAGUE_BELL,
  PALADIN,
  HOLY_FIRE,
  RELIC_SWORD,
  LEECH,
  GRINNING_SKULL,
  ARCHANGEL,
  DEAD_HAND,
  DEVOURING_WOUND,
  TUMOR_GUARDIAN,
  GROANING_COFFIN,
  WAILING_CURSECHILD,
  CRAWLING_CORD,
  INSATIABLE_MAW,
  OMEN_WOMB,
  STELLAR_COCOON,
  FLESH_GRANULATION,
  CHOLERA,
} from "../shared/skill-params";

describe("processAvenge – charnel_pit (independent counters)", () => {
  it("spawns token when counter reaches threshold", () => {
    const pit = makeBattleUnit({
      id: "charnel_pit",
      name: "肉溜",
      atk: 0,
      hp: 6,
      avengeDeathCount: 2,
    });
    const board = [pit];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    expect(pit.avengeDeathCount).toBe(0);
    expect(board.length).toBe(2);
    const token = board.find((u) => u.name === "肉塊");
    expect(token).toBeDefined();
    const t = atLevel(CHARNEL_PIT.token, 1);
    expect(token!.atk).toBe(t.atk);
    expect(token!.hp).toBe(t.hp);
  });

  it("spawns multiple tokens when counter is 2x threshold", () => {
    const pit = makeBattleUnit({
      id: "charnel_pit",
      name: "肉溜",
      atk: 0,
      hp: 6,
      avengeDeathCount: 4,
    });
    const board = [pit];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    expect(pit.avengeDeathCount).toBe(0);
    const tokens = board.filter((u) => u.name === "肉塊");
    expect(tokens.length).toBe(2);
  });

  it("keeps leftover count below threshold", () => {
    const pit = makeBattleUnit({
      id: "charnel_pit",
      name: "肉溜",
      atk: 0,
      hp: 6,
      avengeDeathCount: 3,
    });
    const board = [pit];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    expect(pit.avengeDeathCount).toBe(1);
    expect(board.filter((u) => u.name === "肉塊").length).toBe(1);
  });

  it("both charnel_pits trigger independently", () => {
    const pit1 = makeBattleUnit({
      id: "charnel_pit",
      name: "肉溜1",
      atk: 0,
      hp: 6,
      avengeDeathCount: 2,
    });
    const pit2 = makeBattleUnit({
      id: "charnel_pit",
      name: "肉溜2",
      atk: 0,
      hp: 6,
      avengeDeathCount: 2,
    });
    const board = [pit1, pit2];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    const tokens = board.filter((u) => u.name === "肉塊");
    expect(tokens.length).toBe(2);
    expect(pit1.avengeDeathCount).toBe(0);
    expect(pit2.avengeDeathCount).toBe(0);
  });
});

describe("processAvenge – grinning_skull (independent counters)", () => {
  it("buffs all allies when counter reaches threshold", () => {
    const rel = makeBattleUnit({
      id: "grinning_skull",
      name: "聖骨箱",
      atk: 2,
      hp: 8,
      avengeDeathCount: 3,
    });
    const ally = makeBattleUnit({ atk: 3, hp: 5 });
    const board = [rel, ally];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    expect(rel.avengeDeathCount).toBe(0);
    const b = atLevel(GRINNING_SKULL.buff, 1);
    expect(rel.atk).toBe(2 + b.atk);
    expect(ally.atk).toBe(3 + b.atk);
    expect(ally.hp).toBe(5 + b.hp);
  });

  it("does not trigger below threshold", () => {
    const rel = makeBattleUnit({
      id: "grinning_skull",
      name: "聖骨箱",
      atk: 2,
      hp: 8,
      avengeDeathCount: 2,
    });
    const board = [rel];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    expect(rel.avengeDeathCount).toBe(2);
    expect(ctx.frames).toHaveLength(0);
  });

  it("triggers twice with 6 deaths accumulated", () => {
    const rel = makeBattleUnit({
      id: "grinning_skull",
      name: "聖骨箱",
      atk: 2,
      hp: 8,
      avengeDeathCount: 6,
    });
    const board = [rel];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    const b = atLevel(GRINNING_SKULL.buff, 1);
    expect(rel.atk).toBe(2 + b.atk * 2);
    expect(rel.avengeDeathCount).toBe(0);
  });
});

describe("processAvenge – archangel (independent counters)", () => {
  it("buffs self when counter reaches threshold", () => {
    const arch = makeBattleUnit({
      id: "archangel",
      name: "大天使",
      atk: 6,
      hp: 8,
      avengeDeathCount: 2,
    });
    const board = [arch];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    expect(arch.avengeDeathCount).toBe(0);
    const b = atLevel(ARCHANGEL.buff, 1);
    expect(arch.atk).toBe(6 + b.atk);
    expect(arch.hp).toBe(8 + b.hp);
  });

  it("does not trigger below threshold", () => {
    const arch = makeBattleUnit({
      id: "archangel",
      name: "大天使",
      atk: 6,
      hp: 8,
      avengeDeathCount: 1,
    });
    const board = [arch];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    expect(arch.avengeDeathCount).toBe(1);
    expect(ctx.frames).toHaveLength(0);
  });

  it("triggers twice with 4 deaths accumulated", () => {
    const arch = makeBattleUnit({
      id: "archangel",
      name: "大天使",
      atk: 6,
      hp: 8,
      avengeDeathCount: 4,
    });
    const board = [arch];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    const b = atLevel(ARCHANGEL.buff, 1);
    expect(arch.atk).toBe(6 + b.atk * 2);
    expect(arch.hp).toBe(8 + b.hp * 2);
  });
});

describe("incrementAvengeCounters – independent per-unit", () => {
  it("increments only avenge units, not others", () => {
    const pit = makeBattleUnit({ id: "charnel_pit", hp: 6 });
    const rel = makeBattleUnit({ id: "grinning_skull", hp: 8 });
    const other = makeBattleUnit({ id: "rat", hp: 3 });
    const board = [pit, rel, other];
    incrementAvengeCounters(board);
    expect(pit.avengeDeathCount).toBe(1);
    expect(rel.avengeDeathCount).toBe(1);
    expect(other.avengeDeathCount).toBe(0);
  });

  it("does not increment dead avenge units", () => {
    const pit = makeBattleUnit({ id: "charnel_pit", hp: 0 });
    const board = [pit];
    incrementAvengeCounters(board);
    expect(pit.avengeDeathCount).toBe(0);
  });

  it("charnel_pit and grinning_skull trigger independently on same death count", () => {
    const pit = makeBattleUnit({ id: "charnel_pit", atk: 0, hp: 6, avengeDeathCount: 1 });
    const rel = makeBattleUnit({ id: "grinning_skull", atk: 2, hp: 8, avengeDeathCount: 2 });
    const board = [pit, rel];
    const ctx = makeContext(board, []);
    // Simulate 1 more death → pit reaches 2 (threshold), rel reaches 3 (threshold)
    incrementAvengeCounters(board);
    processAvenge(board, true, ctx);
    expect(pit.avengeDeathCount).toBe(0);
    expect(rel.avengeDeathCount).toBe(0);
    // Both triggered
    expect(board.filter((u) => u.name === "肉塊").length).toBe(1);
    const b = atLevel(GRINNING_SKULL.buff, 1);
    expect(rel.atk).toBe(2 + b.atk);
  });
});

describe("resolveDeaths – hanged_man", () => {
  it("distributes atk and preDeathHp to front allies on death", () => {
    const hanged = makeBattleUnit({
      id: "hanged_man",
      name: "首吊り",
      atk: 10,
      hp: 0,
      preDeathHp: 8,
    });
    const ally1 = makeBattleUnit({ atk: 2, hp: 5 });
    const ally2 = makeBattleUnit({ atk: 3, hp: 4 });
    const ctx = makeContext([hanged, ally1, ally2], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const targets = atLevel(HANGED_MAN.targets, 1);
    const atkShare = Math.floor(10 / targets);
    const hpShare = Math.floor(8 / targets);
    expect(ally1.atk).toBe(2 + atkShare);
    expect(ally1.hp).toBe(5 + hpShare);
    expect(ally2.atk).toBe(3 + atkShare);
    expect(ally2.hp).toBe(4 + hpShare);
  });
});

describe("resolveDeaths – seraph", () => {
  it("buffs all allies on death", () => {
    const seraph = makeBattleUnit({ id: "seraph", name: "熾天使", atk: 4, hp: 0, isChurch: true });
    const ally1 = makeBattleUnit({ atk: 2, hp: 5 });
    const ally2 = makeBattleUnit({ atk: 3, hp: 4 });
    const ctx = makeContext([seraph, ally1, ally2], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const b = atLevel(SERAPH.deathBuff, 1);
    expect(ally1.atk).toBe(2 + b.atk);
    expect(ally1.hp).toBe(5 + b.hp);
    expect(ally2.atk).toBe(3 + b.atk);
    expect(ally2.hp).toBe(4 + b.hp);
  });
});

describe("applyOnHitSkills – flayed_saint", () => {
  it("damages a random enemy on the correct board (player side)", () => {
    const saint = makeBattleUnit({ id: "flayed_saint", name: "聖者", atk: 2, hp: 5 });
    const enemy = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([saint], [enemy], null, { next: () => 0 });
    applyOnHitSkills(saint, ctx.pBoard, true, ctx);
    const dmg = atLevel(FLAYED_SAINT.damage, 1);
    expect(enemy.hp).toBe(10 - dmg);
  });

  it("damages a random enemy on the correct board (enemy side)", () => {
    const saint = makeBattleUnit({ id: "flayed_saint", name: "聖者", atk: 2, hp: 5 });
    const playerUnit = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([playerUnit], [saint], null, { next: () => 0 });
    applyOnHitSkills(saint, ctx.eBoard, false, ctx);
    const dmg = atLevel(FLAYED_SAINT.damage, 1);
    expect(playerUnit.hp).toBe(10 - dmg);
  });
});

describe("on-hit kill → resolveDeaths cascade", () => {
  it("rat killed by flayed_saint on-hit triggers death handler after resolveDeaths", () => {
    const dmg = atLevel(FLAYED_SAINT.damage, 1);
    const rat = makeBattleUnit({ id: "rat", name: "鼠", atk: 1, hp: dmg });
    const bystander = makeBattleUnit({ atk: 2, hp: 5 });
    const saint = makeBattleUnit({ id: "flayed_saint", name: "聖者", atk: 2, hp: 5 });
    const ctx = makeContext([saint], [rat, bystander], null, { next: () => 0 });
    applyOnHitSkills(saint, ctx.pBoard, true, ctx);
    expect(rat.hp).toBeLessThanOrEqual(0);
    resolveDeaths(ctx);
    const b = atLevel(RAT.deathBuff, 1);
    expect(bystander.atk).toBe(2 + b.atk);
    expect(bystander.hp).toBe(5 + b.hp);
  });
});

// ── puppeteer (death mult) ──

describe("resolveDeaths – puppeteer doubles death skill", () => {
  it("doubles hanged_man death effect when puppeteer is in front", () => {
    const puppeteer = makeBattleUnit({ id: "puppeteer", name: "操り糸", atk: 4, hp: 6 });
    const hanged = makeBattleUnit({
      id: "hanged_man",
      name: "首吊り",
      atk: 10,
      hp: 0,
      preDeathHp: 8,
    });
    const ally = makeBattleUnit({ atk: 2, hp: 5 });
    const ctx = makeContext([puppeteer, hanged, ally], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const targets = atLevel(HANGED_MAN.targets, 1);
    const atkShare = Math.floor(10 / targets);
    const hpShare = Math.floor(8 / targets);
    // 2回発動 → 2倍バフ
    expect(ally.atk).toBe(2 + atkShare * 2);
    expect(ally.hp).toBe(5 + hpShare * 2);
  });

  it("does not double when puppeteer is not at deathIdx-1", () => {
    // hanged is at index 0 → board[-1] is undefined → deathMult = 1
    const hanged = makeBattleUnit({
      id: "hanged_man",
      name: "首吊り",
      atk: 10,
      hp: 0,
      preDeathHp: 8,
    });
    const puppeteer = makeBattleUnit({ id: "puppeteer", name: "操り糸", atk: 4, hp: 6 });
    const ally = makeBattleUnit({ atk: 2, hp: 5 });
    const ctx = makeContext([hanged, puppeteer, ally], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const targets = atLevel(HANGED_MAN.targets, 1);
    const atkShare = Math.floor(10 / targets);
    // Only 1x, distributes to front 2: puppeteer and ally
    expect(puppeteer.atk).toBe(4 + atkShare);
    expect(ally.atk).toBe(2 + atkShare);
  });
});

// ── cathedral (death spawn with uses) ──

describe("resolveDeaths – cathedral spawns on ally death", () => {
  it("spawns a token and decrements skillUses", () => {
    // dead.id must not be "token" — cathedral spawn is gated by dead.id !== "token"
    const dying = makeBattleUnit({ id: "beggar", hp: 0 });
    const cathedral = makeBattleUnit({
      id: "cathedral",
      name: "礼拝堂",
      atk: 1,
      hp: 8,
      skillUses: 2,
    });
    const enemy = makeBattleUnit({ hp: 20 });
    const ctx = makeContext([dying, cathedral], [enemy]);
    resolveDeaths(ctx);
    const t = atLevel(CATHEDRAL.token, 1);
    const token = ctx.pBoard.find((u) => u.name === "信徒");
    expect(token).toBeDefined();
    expect(token!.atk).toBe(t.atk);
    expect(token!.hp).toBe(t.hp);
    expect(cathedral.skillUses).toBe(1);
  });

  it("does not spawn when skillUses exhausted", () => {
    const dying = makeBattleUnit({ id: "beggar", hp: 0 });
    const cathedral = makeBattleUnit({
      id: "cathedral",
      name: "礼拝堂",
      atk: 1,
      hp: 8,
      skillUses: 0,
    });
    const ctx = makeContext([dying, cathedral], [makeBattleUnit({ hp: 20 })]);
    resolveDeaths(ctx);
    expect(ctx.pBoard.filter((u) => u.name === "信徒")).toHaveLength(0);
  });
});

// ── organ_grinder (knockout AoE) ──

describe("processKnockoutEffects – organ_grinder", () => {
  it("deals AoE damage to all enemies on knockout", () => {
    const grinder = makeBattleUnit({ id: "organ_grinder", name: "臓腑挽き", atk: 5, hp: 5 });
    const enemy1 = makeBattleUnit({ hp: 10 });
    const enemy2 = makeBattleUnit({ hp: 10 });
    const attackerBoard = [grinder];
    const defenderBoard = [enemy1, enemy2];
    const ctx = makeContext(attackerBoard, defenderBoard);
    processKnockoutEffects(grinder, defenderBoard, attackerBoard, true, ctx);
    const dmg = atLevel(ORGAN_GRINDER.damage, 1);
    expect(enemy1.hp).toBe(10 - dmg);
    expect(enemy2.hp).toBe(10 - dmg);
  });

  it("AoE kill triggers enemy death handler via resolveDeaths", () => {
    const grinder = makeBattleUnit({ id: "organ_grinder", name: "臓腑挽き", atk: 5, hp: 5 });
    const dmg = atLevel(ORGAN_GRINDER.damage, 1);
    const rat = makeBattleUnit({ id: "rat", name: "鼠", atk: 1, hp: dmg });
    const survivor = makeBattleUnit({ atk: 3, hp: 10 });
    const attackerBoard = [grinder];
    const defenderBoard = [rat, survivor];
    const ctx = makeContext(attackerBoard, defenderBoard, null, { next: () => 0 });
    processKnockoutEffects(grinder, defenderBoard, attackerBoard, true, ctx);
    const b = atLevel(RAT.deathBuff, 1);
    expect(survivor.atk).toBe(3 + b.atk);
    expect(survivor.hp).toBe(10 - dmg + b.hp);
  });
});

// ── risen_pope (knockout buff) ──

describe("processKnockoutEffects – risen_pope", () => {
  it("buffs all allies on knockout", () => {
    const inq = makeBattleUnit({ id: "risen_pope", name: "教皇", atk: 4, hp: 6 });
    const ally = makeBattleUnit({ atk: 3, hp: 4 });
    const attackerBoard = [inq, ally];
    const defender = makeBattleUnit({ hp: 5 });
    const ctx = makeContext(attackerBoard, [defender]);
    processKnockoutEffects(inq, [defender], attackerBoard, true, ctx);
    const b = atLevel(RISEN_POPE.buff, 1);
    expect(ally.atk).toBe(3 + b.atk);
    expect(ally.hp).toBe(4 + b.hp);
  });
});

// ── stitched_twin (on-hit self buff + behind damage) ──

describe("applyOnHitSkills – stitched_twin", () => {
  it("buffs self atk and damages unit behind", () => {
    const twin = makeBattleUnit({ id: "stitched_twin", name: "継ぎ接ぎ", atk: 2, hp: 4 });
    const behind = makeBattleUnit({ atk: 3, hp: 10 });
    const board = [twin, behind];
    const ctx = makeContext(board, []);
    applyOnHitSkills(twin, board, true, ctx);
    const b = atLevel(STITCHED_TWIN.atkBuff, 1);
    expect(twin.atk).toBe(2 + b);
    expect(behind.hp).toBe(10 - b);
  });

  it("does not crash when no unit behind", () => {
    const twin = makeBattleUnit({ id: "stitched_twin", name: "継ぎ接ぎ", atk: 2, hp: 4 });
    const board = [twin];
    const ctx = makeContext(board, []);
    applyOnHitSkills(twin, board, true, ctx);
    expect(twin.atk).toBe(2 + atLevel(STITCHED_TWIN.atkBuff, 1));
  });

  it("damages puppeteer behind like any other unit", () => {
    const twin = makeBattleUnit({ id: "stitched_twin", name: "継ぎ接ぎ", atk: 2, hp: 4 });
    const puppet = makeBattleUnit({ id: "puppeteer", name: "操り糸", atk: 4, hp: 6 });
    const board = [twin, puppet];
    const ctx = makeContext(board, []);
    applyOnHitSkills(twin, board, true, ctx);
    const dmg = atLevel(STITCHED_TWIN.atkBuff, 1);
    expect(twin.atk).toBe(2 + dmg);
    expect(puppet.hp).toBe(6 - dmg);
  });
});

// ── crow (death buff) ──

describe("resolveDeaths – crow gains stats on ally death", () => {
  it("buffs crow when an ally dies", () => {
    const dying = makeBattleUnit({ id: "token", hp: 0 });
    const crow = makeBattleUnit({ id: "crow", name: "鴉", atk: 2, hp: 1 });
    const ctx = makeContext([dying, crow], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const b = atLevel(CROW.buff, 1);
    expect(crow.atk).toBe(2 + b.atk);
    expect(crow.hp).toBe(1 + b.hp);
  });
});

// ── sin_eater (death atk absorb) ──

describe("resolveDeaths – sin_eater absorbs dead atk", () => {
  const uses = atLevel(SIN_EATER.uses, 1);

  it("absorbs dead unit atk up to cap", () => {
    const dying = makeBattleUnit({ id: "token", atk: 10, hp: 0 });
    const eater = makeBattleUnit({ id: "sin_eater", name: "黒蟲", atk: 3, hp: 4, skillUses: uses });
    const ctx = makeContext([dying, eater], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const cap = atLevel(SIN_EATER.atkCap, 1);
    expect(eater.atk).toBe(3 + Math.min(10, cap));
  });

  it("caps absorption at level-based limit", () => {
    const dying = makeBattleUnit({ id: "token", atk: 100, hp: 0 });
    const eater = makeBattleUnit({ id: "sin_eater", name: "黒蟲", atk: 3, hp: 4, skillUses: uses });
    const ctx = makeContext([dying, eater], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const cap = atLevel(SIN_EATER.atkCap, 1);
    expect(eater.atk).toBe(3 + cap);
  });

  it("stops absorbing after uses are exhausted", () => {
    const cap = atLevel(SIN_EATER.atkCap, 1);
    const eater = makeBattleUnit({
      id: "sin_eater",
      name: "黒蟲",
      atk: 3,
      hp: 10,
      skillUses: uses,
    });
    // uses 回 + 1 回死亡させる → uses 回目まで吸収、それ以降は吸収しない
    const dying = Array.from({ length: uses + 1 }, () =>
      makeBattleUnit({ id: "token", atk: 10, hp: 0 }),
    );
    const ctx = makeContext([...dying, eater], [makeBattleUnit({ hp: 50 })]);
    resolveDeaths(ctx);
    expect(eater.atk).toBe(3 + cap * uses);
    expect(eater.skillUses).toBe(0);
  });
});

// ── howling_giant (on-hit all ally atk buff) ──

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

// ── flagellant (on-hit behind buff) ──

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

// ── budding_hydra (death: HP-dependent token spawn) ──

describe("budding_hydra – death spawns", () => {
  it("spawns floor(HP / divisor) tokens on death", () => {
    const hydra = makeBattleUnit({
      id: "budding_hydra",
      name: "肉芽のヒドラ",
      atk: 3,
      hp: 0,
      preDeathHp: 10,
    });
    const board: BattleUnit[] = [];
    const ctx = makeContext(board, []);
    callDeathHandler("budding_hydra", hydra, board, 0, true, ctx);
    const divisor = atLevel(BUDDING_HYDRA.divisor, 1);
    const t = atLevel(BUDDING_HYDRA.token, 1);
    const tokens = board.filter((u) => u.name === "ヒドラの首");
    expect(tokens.length).toBe(Math.floor(10 / divisor));
    for (const tk of tokens) {
      expect(tk.atk).toBe(t.atk);
      expect(tk.hp).toBe(t.hp);
    }
  });

  it("spawns more tokens with higher HP", () => {
    const hydra = makeBattleUnit({
      id: "budding_hydra",
      name: "肉芽のヒドラ",
      atk: 3,
      hp: 0,
      preDeathHp: 20,
    });
    const board: BattleUnit[] = [];
    const ctx = makeContext(board, []);
    callDeathHandler("budding_hydra", hydra, board, 0, true, ctx);
    const divisor = atLevel(BUDDING_HYDRA.divisor, 1);
    expect(board.filter((u) => u.name === "ヒドラの首").length).toBe(Math.floor(20 / divisor));
  });

  it("spawns nothing when HP < divisor", () => {
    const hydra = makeBattleUnit({
      id: "budding_hydra",
      name: "肉芽のヒドラ",
      atk: 3,
      hp: 0,
      preDeathHp: 3,
    });
    const board: BattleUnit[] = [];
    const ctx = makeContext(board, []);
    callDeathHandler("budding_hydra", hydra, board, 0, true, ctx);
    expect(board.filter((u) => u.name === "ヒドラの首")).toHaveLength(0);
  });

  it("caps spawns at MAX_BOARD_SIZE", () => {
    const hydra = makeBattleUnit({
      id: "budding_hydra",
      name: "肉芽のヒドラ",
      atk: 3,
      hp: 0,
      preDeathHp: 100,
    });
    const board: BattleUnit[] = [];
    const ctx = makeContext(board, []);
    callDeathHandler("budding_hydra", hydra, board, 0, true, ctx);
    expect(board.filter((u) => u.name === "ヒドラの首").length).toBeLessThanOrEqual(MAX_BOARD_SIZE);
  });

  it("respects remaining board capacity", () => {
    const hydra = makeBattleUnit({
      id: "budding_hydra",
      name: "肉芽のヒドラ",
      atk: 3,
      hp: 0,
      preDeathHp: 100,
    });
    const existing = Array.from({ length: 3 }, () =>
      makeBattleUnit({ id: "token", atk: 1, hp: 1 }),
    );
    const board: BattleUnit[] = [...existing];
    const ctx = makeContext(board, []);
    callDeathHandler("budding_hydra", hydra, board, 0, true, ctx);
    expect(board.length).toBeLessThanOrEqual(MAX_BOARD_SIZE);
    expect(board.filter((u) => u.name === "ヒドラの首").length).toBe(MAX_BOARD_SIZE - 3);
  });
});

// ── catacomb_rat (start skill: tier×mult damage) ──

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

// ── plague_bell (before-attack: AoE damage with limited uses) ──

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

// ── paladin (start skill: HP buff to all allies) ──

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

// ── holy_fire (start skill: damage to highest HP enemy) ──

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

// ── famine_corpse (before-attack: debuff enemy front atk) ──

describe("applyBeforeAttackSkills – famine_corpse", () => {
  it("debuffs enemy front unit atk by own atk", () => {
    const front = makeBattleUnit({ atk: 5, hp: 10 });
    const famine = makeBattleUnit({ id: "famine_corpse", name: "蝗", atk: 3, hp: 3 });
    const ctx = makeContext([front, famine], [makeBattleUnit({ hp: 10, atk: 4 })]);
    applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(front.atk).toBe(5);
    expect(famine.atk).toBe(3);
    expect(ctx.eBoard[0]!.atk).toBe(Math.max(1, 4 - 3)); // debuff = famine.atk
  });

  it("floors atk at 1", () => {
    const front = makeBattleUnit({ atk: 5, hp: 10 });
    const famine = makeBattleUnit({ id: "famine_corpse", name: "蝗", atk: 3, hp: 3 });
    const weakEnemy = makeBattleUnit({ hp: 10, atk: 1 });
    const ctx = makeContext([front, famine], [weakEnemy]);
    applyBeforeAttackSkills(ctx.pBoard, ctx.eBoard, true, ctx);
    expect(weakEnemy.atk).toBe(1);
  });
});

// ── relic_sword (before-attack: buff front ally atk) ──

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

// ── leech (on-hit: self HP buff) ──

describe("applyOnHitSkills – leech", () => {
  it("gains HP when hit", () => {
    const leech = makeBattleUnit({ id: "leech", name: "蛭", atk: 1, hp: 2 });
    const board = [leech];
    const ctx = makeContext(board, []);
    applyOnHitSkills(leech, board, true, ctx);
    const buff = atLevel(LEECH.hpBuff, 1);
    expect(leech.hp).toBe(2 + buff);
  });

  it("does not trigger when hp <= 0", () => {
    const leech = makeBattleUnit({ id: "leech", name: "蛭", atk: 1, hp: 0 });
    const board = [leech];
    const ctx = makeContext(board, []);
    applyOnHitSkills(leech, board, true, ctx);
    expect(leech.hp).toBe(0);
  });
});

// ── blood_font (deploy: HP buff to lowest HP ally) ──

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

// ── MAX_BOARD_SIZE ガード ──

describe("spawnTokenAndNotify – board size guard", () => {
  it("returns null and does not grow board when at MAX_BOARD_SIZE", () => {
    const units = Array.from({ length: MAX_BOARD_SIZE }, () => makeBattleUnit({ hp: 5 }));
    const ctx = makeContext(units, []);
    const result = spawnTokenAndNotify({
      board: units,
      idx: 0,
      name: "test",
      atk: 1,
      hp: 1,
      isChurch: false,
      segments: () => [],
      isPlayer: true,
      ctx,
    });
    expect(result).toBeNull();
    expect(units).toHaveLength(MAX_BOARD_SIZE);
  });

  it("spawns when board has room", () => {
    const units = [makeBattleUnit({ hp: 5 })];
    const ctx = makeContext(units, []);
    const result = spawnTokenAndNotify({
      board: units,
      idx: 0,
      name: "test",
      atk: 1,
      hp: 1,
      isChurch: false,
      segments: () => [],
      isPlayer: true,
      ctx,
    });
    expect(result).not.toBeNull();
    expect(units).toHaveLength(2);
  });
});

describe("handleBeelzebubSpawns – board size guard", () => {
  it("stops spawning when board reaches MAX_BOARD_SIZE", () => {
    const filler = Array.from({ length: MAX_BOARD_SIZE - 1 }, () => makeBattleUnit({ hp: 5 }));
    const beelzebub = makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", atk: 4, hp: 4 });
    const board = [beelzebub, ...filler];
    // board.length = 5 (MAX_BOARD_SIZE), so no flies should spawn
    const ctx = makeContext(board, []);
    handleBeelzebubSpawns(board, true, ctx, 0);
    expect(board).toHaveLength(MAX_BOARD_SIZE);
    expect(ctx.pFlyCount).toBe(0);
  });

  it("spawns only until board is full", () => {
    const beelzebub = makeBattleUnit({ id: "beelzebub", name: "ベルゼブブ", atk: 4, hp: 4 });
    const brains = makeBattleUnit({ id: "brains", name: "双子脳", atk: 6, hp: 4 });
    // board = 3 units, MAX_BOARD_SIZE = 5, brains doubles → wants 2 flies, room for 2
    const board = [beelzebub, brains, makeBattleUnit({ hp: 5 })];
    const ctx = makeContext(board, []);
    handleBeelzebubSpawns(board, true, ctx, 0);
    expect(board.length).toBe(MAX_BOARD_SIZE);
    expect(ctx.pFlyCount).toBe(2);
  });
});

describe("resolveDeaths – beast death board size guard", () => {
  it("spawns after beast removal frees a slot", () => {
    const beast = makeBattleUnit({ id: "beast", name: "獣", atk: 4, hp: 0 });
    const filler = Array.from({ length: MAX_BOARD_SIZE - 1 }, () => makeBattleUnit({ hp: 5 }));
    const board = [beast, ...filler];
    const ctx = makeContext(board, [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    // beast spliced out (4 remain) → death handler spawns a tier-3 unit (back to 5)
    expect(ctx.pBoard.length).toBe(MAX_BOARD_SIZE);
    expect(ctx.pBoard.every((u) => u.id !== "beast")).toBe(true);
  });
});

// ── puppeteer vs brains: ally reaction は getMult(=brains) 経由。puppeteer は死亡スキルのみ ──

describe("puppeteer does NOT double ally reactions (getMult only checks brains)", () => {
  it("puppeteer in front of crow does not double crow death buff", () => {
    const dying = makeBattleUnit({ id: "beggar", hp: 0 });
    const puppeteer = makeBattleUnit({ id: "puppeteer", name: "操り糸", atk: 4, hp: 6 });
    const crow = makeBattleUnit({ id: "crow", name: "鴉", atk: 2, hp: 1 });
    const ctx = makeContext([dying, puppeteer, crow], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const b = atLevel(CROW.buff, 1);
    // getMult checks brains, not puppeteer → crow triggers once
    expect(crow.atk).toBe(2 + b.atk);
    expect(crow.hp).toBe(1 + b.hp);
  });

  it("brains behind crow DOES double crow death buff", () => {
    const dying = makeBattleUnit({ id: "beggar", hp: 0 });
    const crow = makeBattleUnit({ id: "crow", name: "鴉", atk: 2, hp: 1 });
    const brains = makeBattleUnit({ id: "brains", name: "双子脳", atk: 6, hp: 4 });
    const ctx = makeContext([dying, crow, brains], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const b = atLevel(CROW.buff, 1);
    // getMult returns 2 (brains behind crow) → crow triggers twice
    expect(crow.atk).toBe(2 + b.atk * 2);
    expect(crow.hp).toBe(1 + b.hp * 2);
  });

  it("puppeteer in front of cathedral does not double cathedral spawn", () => {
    const dying = makeBattleUnit({ id: "beggar", hp: 0 });
    const puppeteer = makeBattleUnit({ id: "puppeteer", name: "操り糸", atk: 4, hp: 6 });
    const cathedral = makeBattleUnit({
      id: "cathedral",
      name: "礼拝堂",
      atk: 1,
      hp: 8,
      skillUses: 2,
    });
    const ctx = makeContext([dying, puppeteer, cathedral], [makeBattleUnit({ hp: 20 })]);
    resolveDeaths(ctx);
    // puppeteer does not affect getMult → cathedral spawns once
    expect(ctx.pBoard.filter((u) => u.name === "信徒")).toHaveLength(1);
    expect(cathedral.skillUses).toBe(1);
  });
});

// ── successor再計算: spawnでboardが変わっても正しいsuccessorを参照する ──

describe("successor recalculation on multi-trigger", () => {
  it("hound with brains spawns 2 tokens at correct position", () => {
    const hound = makeBattleUnit({ id: "hound", name: "猟犬", atk: 3, hp: 0 });
    const brains = makeBattleUnit({ id: "brains", name: "双子脳", atk: 6, hp: 4 });
    const ally = makeBattleUnit({ atk: 2, hp: 5 });
    const ctx = makeContext([hound, brains, ally], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const tokens = ctx.pBoard.filter((u) => u.name === "噛み付く頭部");
    expect(tokens).toHaveLength(2);
  });
});

// ── puppeteerはユニット死亡スキルのみ2倍、装備死亡効果はbrains(mult)でのみ乗算 ──

describe("puppeteer doubles unit skill only, not equip death", () => {
  it("puppeteer + hound with maggot_nest: 2 heads (skill×2) + 1 maggot (equip×1)", () => {
    const puppeteer = makeBattleUnit({ id: "puppeteer", name: "操り糸", atk: 4, hp: 6 });
    const hound = makeBattleUnit({
      id: "hound",
      name: "猟犬",
      atk: 3,
      hp: 0,
      equip: "maggot_nest",
    });
    const ctx = makeContext([puppeteer, hound], [makeBattleUnit({ hp: 10 })]);
    resolveDeaths(ctx);
    const heads = ctx.pBoard.filter((u) => u.name === "噛み付く頭部");
    const maggots = ctx.pBoard.filter((u) => u.name === "巨大蛆虫");
    expect(heads).toHaveLength(2);
    expect(maggots).toHaveLength(1);
  });
});

// ── avengeスナップショット: spawn後も後続avengeユニットがスキップされない ──

describe("processAvenge snapshot – spawn does not skip later avenge units", () => {
  it("CharnelPit spawn does not skip GrinningSkull", () => {
    const pit = makeBattleUnit({
      id: "charnel_pit",
      name: "肉溜",
      atk: 0,
      hp: 6,
      avengeDeathCount: 2,
    });
    const skull = makeBattleUnit({
      id: "grinning_skull",
      name: "聖骨箱",
      atk: 2,
      hp: 8,
      avengeDeathCount: 3,
    });
    const board = [pit, skull];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    // Both should trigger
    expect(pit.avengeDeathCount).toBe(0);
    expect(skull.avengeDeathCount).toBe(0);
    expect(board.filter((u) => u.name === "肉塊")).toHaveLength(1);
    const b = atLevel(GRINNING_SKULL.buff, 1);
    expect(skull.atk).toBe(2 + b.atk);
  });
});

// ── 撃破スキル: dead_hand, devouring_wound ──

describe("processKnockoutEffects – dead_hand", () => {
  it("heals self on knockout", () => {
    const unit = makeBattleUnit({ id: "dead_hand", name: "齧りつく死手", atk: 2, hp: 3 });
    const board = [unit];
    const enemy = makeBattleUnit({ hp: 0 });
    const ctx = makeContext(board, [enemy]);
    processKnockoutEffects(unit, ctx.eBoard, board, true, ctx);
    const heal = atLevel(DEAD_HAND.hpHeal, 1);
    expect(unit.hp).toBe(3 + heal);
    expect(ctx.frames).toHaveLength(1);
  });

  it("does nothing when dead", () => {
    const unit = makeBattleUnit({ id: "dead_hand", name: "齧りつく死手", atk: 2, hp: 0 });
    const board = [unit];
    const ctx = makeContext(board, []);
    processKnockoutEffects(unit, ctx.eBoard, board, true, ctx);
    expect(unit.hp).toBe(0);
    expect(ctx.frames).toHaveLength(0);
  });
});

describe("processKnockoutEffects – devouring_wound", () => {
  it("heals self on knockout", () => {
    const unit = makeBattleUnit({ id: "devouring_wound", name: "喰らう傷口", atk: 3, hp: 4 });
    const board = [unit];
    const enemy = makeBattleUnit({ hp: 0 });
    const ctx = makeContext(board, [enemy]);
    processKnockoutEffects(unit, ctx.eBoard, board, true, ctx);
    const heal = atLevel(DEVOURING_WOUND.hpHeal, 1);
    expect(unit.hp).toBe(4 + heal);
    expect(ctx.frames).toHaveLength(1);
  });
});

// ── 被弾スキル: tumor_guardian, amniotic_armor ──

describe("applyOnHitSkills – tumor_guardian", () => {
  it("buffs unit behind on hit", () => {
    const guardian = makeBattleUnit({ id: "tumor_guardian", name: "瘤の守り手", atk: 2, hp: 6 });
    const behind = makeBattleUnit({ id: INERT_UNIT_ID, atk: 3, hp: 3 });
    const board = [guardian, behind];
    const ctx = makeContext(board, []);
    applyOnHitSkills(guardian, board, true, ctx);
    const b = atLevel(TUMOR_GUARDIAN.buff, 1);
    expect(behind.atk).toBe(3 + b.atk);
    expect(behind.hp).toBe(3 + b.hp);
  });

  it("does nothing when no unit behind", () => {
    const guardian = makeBattleUnit({ id: "tumor_guardian", name: "瘤の守り手", atk: 2, hp: 6 });
    const board = [guardian];
    const ctx = makeContext(board, []);
    applyOnHitSkills(guardian, board, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });
});

describe("applyOnHitSkills – amniotic_armor", () => {
  it("grants corpse_wax on first hit with skillUses", () => {
    const armor = makeBattleUnit({
      id: "amniotic_armor",
      name: "羊膜の鎧",
      atk: 2,
      hp: 8,
      skillUses: 1,
    });
    const board = [armor];
    const ctx = makeContext(board, []);
    applyOnHitSkills(armor, board, true, ctx);
    expect(armor.equip).toBe("corpse_wax");
    expect(armor.skillUses).toBe(0);
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
    const armor = makeBattleUnit({
      id: "amniotic_armor",
      name: "羊膜の鎧",
      atk: 2,
      hp: 8,
      skillUses: 1,
      equip: "iron",
    });
    const board = [armor];
    const ctx = makeContext(board, []);
    applyOnHitSkills(armor, board, true, ctx);
    expect(armor.equip).toBe("iron");
    expect(armor.skillUses).toBe(1);
  });
});

// ── 死亡スキル: graft_scion, omen_womb, stellar_cocoon ──

function callDeathHandler(
  id: string,
  dead: BattleUnit,
  board: BattleUnit[],
  idx: number,
  isPlayer: boolean,
  ctx: BattleContext,
  successor: BattleUnit | null = null,
) {
  const handler = getDeathHandler(id as UnitId);
  invariant(handler, `no death handler for "${id}"`);
  handler({ dead, board, idx, isPlayer, ctx, successor, successor2: null });
}

describe("handleGraftScionDeath", () => {
  it("transfers dead ATK to successor", () => {
    const successor = makeBattleUnit({ id: INERT_UNIT_ID, atk: 3, hp: 5 });
    const board = [successor];
    const dead = makeBattleUnit({ id: "graft_scion", name: "接ぎ穂の残骸", atk: 4, hp: 0 });
    const ctx = makeContext(board, []);
    callDeathHandler("graft_scion", dead, board, 0, true, ctx, successor);
    expect(successor.atk).toBe(3 + 4);
    expect(ctx.frames).toHaveLength(1);
  });

  it("does nothing without successor", () => {
    const board: BattleUnit[] = [];
    const dead = makeBattleUnit({ id: "graft_scion", name: "接ぎ穂の残骸", atk: 4, hp: 0 });
    const ctx = makeContext(board, []);
    callDeathHandler("graft_scion", dead, board, 0, true, ctx, null);
    expect(ctx.frames).toHaveLength(0);
  });
});

describe("handleOmenWombDeath", () => {
  it("spawns 2 tokens with correct stats", () => {
    const board: BattleUnit[] = [];
    const dead = makeBattleUnit({ id: "omen_womb", name: "忌み腹の屍", atk: 2, hp: 0 });
    const ctx = makeContext(board, []);
    callDeathHandler("omen_womb", dead, board, 0, true, ctx);
    const t = atLevel(OMEN_WOMB.token, 1);
    const tokens = board.filter((u) => u.name === "忌み子");
    expect(tokens).toHaveLength(2);
    expect(tokens[0]!.atk).toBe(t.atk);
    expect(tokens[0]!.hp).toBe(t.hp);
  });
});

describe("handleStellarCocoonDeath", () => {
  it("spawns star_child unit with correct stats", () => {
    const board: BattleUnit[] = [];
    const dead = makeBattleUnit({ id: "stellar_cocoon", name: "星辰の繭", atk: 4, hp: 0 });
    const ctx = makeContext(board, []);
    callDeathHandler("stellar_cocoon", dead, board, 0, true, ctx);
    const t = atLevel(STELLAR_COCOON.summon, 1);
    const children = board.filter((u) => u.id === "star_child");
    expect(children).toHaveLength(1);
    expect(children[0]!.atk).toBe(t.atk);
    expect(children[0]!.hp).toBe(t.hp);
  });
});

describe("handleStarChildDeath – frenzy", () => {
  it("killer attacks a random ally on star_child death", () => {
    const child = makeBattleUnit({
      id: "star_child",
      name: "星の落とし子",
      hp: 0,
      lastDamageSource: "killer-uid",
    });
    const killer = makeBattleUnit({ uid: "killer-uid", atk: 5, hp: 10 });
    const ally = makeBattleUnit({ uid: "ally-uid", atk: 3, hp: 8 });
    const ctx = makeContext([], [killer, ally], null, { next: () => 0 });
    callDeathHandler("star_child", child, ctx.pBoard, 0, true, ctx);
    expect(ally.hp).toBe(3); // 8 - 5 killer ATK
  });

  it("does nothing when killer is dead", () => {
    const child = makeBattleUnit({
      id: "star_child",
      name: "星の落とし子",
      hp: 0,
      lastDamageSource: "killer-uid",
    });
    const killer = makeBattleUnit({ uid: "killer-uid", atk: 5, hp: 0 });
    const ally = makeBattleUnit({ uid: "ally-uid", atk: 3, hp: 8 });
    const ctx = makeContext([], [killer, ally], null, { next: () => 0 });
    callDeathHandler("star_child", child, ctx.pBoard, 0, true, ctx);
    expect(ally.hp).toBe(8);
  });

  it("does nothing when killer has no allies", () => {
    const child = makeBattleUnit({
      id: "star_child",
      name: "星の落とし子",
      hp: 0,
      lastDamageSource: "killer-uid",
    });
    const killer = makeBattleUnit({ uid: "killer-uid", atk: 5, hp: 10 });
    const ctx = makeContext([], [killer], null, { next: () => 0 });
    callDeathHandler("star_child", child, ctx.pBoard, 0, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });

  it("does nothing when no lastDamageSource", () => {
    const child = makeBattleUnit({ id: "star_child", name: "星の落とし子", hp: 0 });
    const enemy = makeBattleUnit({ uid: "e1", atk: 5, hp: 10 });
    const ctx = makeContext([], [enemy], null, { next: () => 0 });
    callDeathHandler("star_child", child, ctx.pBoard, 0, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });
});

// ── Avengeスキル: groaning_coffin, wailing_cursechild ──

describe("processAvenge – groaning_coffin", () => {
  it("deals damage to random enemy when threshold reached", () => {
    const coffin = makeBattleUnit({
      id: "groaning_coffin",
      name: "唸る棺",
      atk: 2,
      hp: 5,
      avengeDeathCount: 2,
    });
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, hp: 10 });
    const board = [coffin];
    const ctx = makeContext(board, [enemy]);
    processAvenge(board, true, ctx);
    const dmg = atLevel(GROANING_COFFIN.damage, 1);
    expect(enemy.hp).toBe(10 - dmg);
    expect(coffin.avengeDeathCount).toBe(0);
    expect(ctx.frames).toHaveLength(1);
  });

  it("does not trigger below threshold", () => {
    const coffin = makeBattleUnit({
      id: "groaning_coffin",
      name: "唸る棺",
      atk: 2,
      hp: 5,
      avengeDeathCount: 1,
    });
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, hp: 10 });
    const board = [coffin];
    const ctx = makeContext(board, [enemy]);
    processAvenge(board, true, ctx);
    expect(enemy.hp).toBe(10);
    expect(ctx.frames).toHaveLength(0);
  });
});

describe("processAvenge – wailing_cursechild", () => {
  it("buffs all allies when threshold reached", () => {
    const child = makeBattleUnit({
      id: "wailing_cursechild",
      name: "啼き喚く呪い児",
      atk: 3,
      hp: 7,
      avengeDeathCount: 3,
    });
    const ally = makeBattleUnit({ id: INERT_UNIT_ID, atk: 2, hp: 3 });
    const board = [child, ally];
    const ctx = makeContext(board, []);
    processAvenge(board, true, ctx);
    const b = atLevel(WAILING_CURSECHILD.buff, 1);
    expect(child.atk).toBe(3 + b.atk);
    expect(child.hp).toBe(7 + b.hp);
    expect(ally.atk).toBe(2 + b.atk);
    expect(ally.hp).toBe(3 + b.hp);
    expect(child.avengeDeathCount).toBe(0);
  });
});

// ── 味方死亡リアクション: crawling_cord, insatiable_maw ──

describe("handleCrawlingCordBuff", () => {
  it("buffs a random living ally on ally death", () => {
    const cord = makeBattleUnit({
      id: "crawling_cord",
      name: "這い回る臍帯",
      atk: 2,
      hp: 3,
      skillUses: 3,
    });
    const ally = makeBattleUnit({ id: INERT_UNIT_ID, atk: 3, hp: 4 });
    const board = [cord, ally];
    const ctx = makeContext(board, []);
    handleCrawlingCordBuff(board, true, ctx);
    const b = atLevel(CRAWLING_CORD.buff, 1);
    expect(ally.atk).toBe(3 + b.atk);
    expect(ally.hp).toBe(4 + b.hp);
    expect(ctx.frames).toHaveLength(1);
  });

  it("does nothing when no other living allies", () => {
    const cord = makeBattleUnit({
      id: "crawling_cord",
      name: "這い回る臍帯",
      atk: 2,
      hp: 3,
      skillUses: 3,
    });
    const board = [cord];
    const ctx = makeContext(board, []);
    handleCrawlingCordBuff(board, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });
});

describe("handleInsatiableMawBuff", () => {
  it("buffs self on ally death", () => {
    const maw = makeBattleUnit({ id: "insatiable_maw", name: "飽くなき咢", atk: 4, hp: 4 });
    const board = [maw];
    const ctx = makeContext(board, []);
    handleInsatiableMawBuff(board, true, ctx);
    const b = atLevel(INSATIABLE_MAW.buff, 1);
    expect(maw.atk).toBe(4 + b.atk);
    expect(maw.hp).toBe(4 + b.hp);
    expect(ctx.frames).toHaveLength(1);
  });
});

// ── flesh_granulation: 味方召喚時に自身バフ ──

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

// ── corroding_mold: 開戦スキル（前方バフ） ──

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

// ── devouring_graft: 開戦スキル+死亡スキル ──

describe("devouring_graft – start skill", () => {
  it("absorbs predecessor and gains stats", () => {
    const pred = makeBattleUnit({ id: "rat", name: "疫病ネズミ", atk: 5, hp: 3 });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const board = [pred, graft];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    expect(graft.atk).toBe(3 + 5);
    expect(graft.hp).toBe(6 + 3);
    expect(board).toHaveLength(1);
    expect(board[0]).toBe(graft);
    expect(ctx.absorbedUnits.has(graft.uid)).toBe(true);
  });

  it("absorbs token stats and stores absorbed data", () => {
    const token = makeBattleUnit({ id: INERT_UNIT_ID, name: "肉塊", atk: 2, hp: 2 });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const board = [token, graft];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    expect(graft.atk).toBe(3 + 2);
    expect(graft.hp).toBe(6 + 2);
    expect(board).toHaveLength(1);
    expect(ctx.absorbedUnits.has(graft.uid)).toBe(true);
  });

  it("does nothing at position 0", () => {
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const board = [graft];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    expect(graft.atk).toBe(3);
    expect(board).toHaveLength(1);
    expect(ctx.absorbedUnits.size).toBe(0);
  });
});

describe("devouring_graft – death re-summon", () => {
  it("re-spawns absorbed unit on death", () => {
    const pred = makeBattleUnit({ id: "rat", name: "疫病ネズミ", atk: 5, hp: 3 });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const pBoard = [pred, graft];
    const ctx = makeContext(pBoard, []);
    runStartSkills(ctx.pBoard, [], true, ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.atk).toBe(3 + 5);
    // Kill graft
    ctx.pBoard[0]!.hp = 0;
    resolveDeaths(ctx);
    // Absorbed unit should be re-spawned
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.name).toBe("疫病ネズミ");
    expect(ctx.pBoard[0]!.atk).toBe(Math.floor(5 * 0.5));
    expect(ctx.pBoard[0]!.hp).toBe(Math.max(1, Math.floor(3 * 0.5)));
  });

  it("re-spawns absorbed church unit on death", () => {
    const pred = makeBattleUnit({
      id: "squire",
      name: "見習い従騎士",
      atk: 2,
      hp: 3,
      isChurch: true,
    });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const pBoard = [pred, graft];
    const ctx = makeContext(pBoard, []);
    runStartSkills(ctx.pBoard, [], true, ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.atk).toBe(3 + 2);
    ctx.pBoard[0]!.hp = 0;
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.name).toBe("見習い従騎士");
    expect(ctx.pBoard[0]!.atk).toBe(Math.floor(2 * 0.5));
    expect(ctx.pBoard[0]!.hp).toBe(Math.max(1, Math.floor(3 * 0.5)));
  });

  it("re-spawns absorbed token on death", () => {
    const token = makeBattleUnit({ id: INERT_UNIT_ID, name: "肉塊", atk: 4, hp: 3 });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const pBoard = [token, graft];
    const ctx = makeContext(pBoard, []);
    runStartSkills(ctx.pBoard, [], true, ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.atk).toBe(3 + 4);
    ctx.pBoard[0]!.hp = 0;
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.id).toBe("token");
    expect(ctx.pBoard[0]!.name).toBe("肉塊");
    expect(ctx.pBoard[0]!.atk).toBe(Math.floor(4 * 0.5));
    expect(ctx.pBoard[0]!.hp).toBe(Math.max(1, Math.floor(3 * 0.5)));
  });

  it("does nothing if no absorbed data", () => {
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 0 });
    const board: BattleUnit[] = [];
    const ctx = makeContext(board, []);
    const handler = getDeathHandler("devouring_graft" as UnitId);
    invariant(handler, "handler must exist");
    handler({ dead: graft, board, idx: 0, isPlayer: true, ctx, successor: null, successor2: null });
    expect(board).toHaveLength(0);
    expect(ctx.frames).toHaveLength(0);
  });

  it("preserves absorbed unit equipment on re-summon", () => {
    const pred = makeBattleUnit({ id: "rat", name: "疫病ネズミ", atk: 5, hp: 3, equip: "iron" });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const pBoard = [pred, graft];
    const ctx = makeContext(pBoard, []);
    runStartSkills(ctx.pBoard, [], true, ctx);
    expect(ctx.pBoard).toHaveLength(1);
    ctx.pBoard[0]!.hp = 0;
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.name).toBe("疫病ネズミ");
    expect(ctx.pBoard[0]!.equip).toBe("iron");
  });

  it("re-summons with null equip when absorbed had no equipment", () => {
    const pred = makeBattleUnit({ id: "rat", name: "疫病ネズミ", atk: 5, hp: 3 });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const pBoard = [pred, graft];
    const ctx = makeContext(pBoard, []);
    runStartSkills(ctx.pBoard, [], true, ctx);
    ctx.pBoard[0]!.hp = 0;
    resolveDeaths(ctx);
    expect(ctx.pBoard[0]!.equip).toBeNull();
  });
});

// ── necrotic_finger: 即死攻撃 ──

describe("necrotic_finger – instant kill (integration)", () => {
  it("kills enemy regardless of HP in battle", () => {
    const finger = makeBattleUnit({
      id: "necrotic_finger",
      name: "壊死した指",
      atk: 1,
      hp: 1,
    });
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 100 });
    const ctx = makeContext([finger], [enemy]);
    runBattle(ctx, makeEnemyTeam([]), 1);
    // ダメージフレームは実ダメージのみ (ATK 1 → 100→99)
    const damageFrames = ctx.frames.filter((f) => f.log.type === "damage");
    expect(damageFrames.length).toBeGreaterThan(0);
    expect(damageFrames[0]!.eBoard[0]?.hp).toBe(99);
    // 即死は独立したスキルフレームに分離
    const necroFrames = ctx.frames.filter(
      (f) => f.log.type === "skill" && segmentsToPlainText(f.log.segments).includes("朽ちる"),
    );
    expect(necroFrames.length).toBeGreaterThan(0);
    expect(necroFrames[0]!.eBoard[0]?.hp).toBe(0);
  });

  it("corpse_wax blocks necrotic_finger instant kill", () => {
    const finger = makeBattleUnit({
      id: "necrotic_finger",
      name: "壊死した指",
      atk: 1,
      hp: 1,
    });
    const tank = makeBattleUnit({ id: INERT_UNIT_ID, atk: 5, hp: 20, equip: "corpse_wax" });
    const ctx = makeContext([finger], [tank]);
    runBattle(ctx, makeEnemyTeam([]), 1);
    expect(ctx.pBoard).toHaveLength(0);
    expect(ctx.eBoard).toHaveLength(1);
    expect(ctx.eBoard[0]!.hp).toBeGreaterThan(0);
  });
});

// ── mimicking_flesh: スキルコピー ──

describe("mimicking_flesh – skill copy", () => {
  it("copies predecessor id and fires start skill", () => {
    const bat = makeBattleUnit({ id: "bat", name: "死蝙蝠", atk: 2, hp: 1 });
    const mimic = makeBattleUnit({ id: "mimicking_flesh", name: "模倣する粘肉", atk: 4, hp: 3 });
    const enemy = makeBattleUnit({ id: INERT_UNIT_ID, atk: 1, hp: 10 });
    const board = [bat, mimic];
    const ctx = makeContext(board, [enemy]);
    runStartSkills(board, [enemy], true, ctx);
    expect(mimic.id).toBe("bat");
    expect(mimic.name).toBe("死蝙蝠");
    expect(enemy.hp).toBeLessThan(10);
  });

  it("does nothing without predecessor", () => {
    const mimic = makeBattleUnit({ id: "mimicking_flesh", name: "模倣する粘肉", atk: 4, hp: 3 });
    const board = [mimic];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    expect(mimic.id).toBe("mimicking_flesh");
  });
});

// ── mimicking_flesh + devouring_graft: スキル間相互作用 ──

describe("mimicking_flesh + devouring_graft – interaction edge cases", () => {
  it("chain absorption: mimic copies graft after graft absorbs predecessor", () => {
    const rat = makeBattleUnit({ id: "rat", name: "疫病ネズミ", atk: 2, hp: 1 });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const mimic = makeBattleUnit({ id: "mimicking_flesh", name: "模倣する粘肉", atk: 4, hp: 3 });
    const board = [rat, graft, mimic];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    // graft absorbs rat, then mimic copies graft and absorbs graft
    expect(board).toHaveLength(1);
    expect(board[0]).toBe(mimic);
    expect(mimic.id).toBe("devouring_graft");
    expect(mimic.atk).toBe(4 + (3 + 2));
    expect(mimic.hp).toBe(3 + (6 + 1));
    expect(ctx.absorbedUnits.has(mimic.uid)).toBe(true);
    const absorbed = ctx.absorbedUnits.get(mimic.uid)!;
    expect(absorbed.id).toBe("devouring_graft");
  });

  it("mimic copies cholera and gets initOverride applied", () => {
    const cholera = makeBattleUnit({ id: "cholera", name: "コレラ", atk: 3, hp: 3 });
    const mimic = makeBattleUnit({ id: "mimicking_flesh", name: "模倣する粘肉", atk: 4, hp: 3 });
    const board = [cholera, mimic];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    expect(mimic.id).toBe("cholera");
    expect(mimic.skillUses).toBe(atLevel(CHOLERA.uses, mimic.level));
  });

  it("graft absorbs mimic; re-spawns mimicking_flesh on death", () => {
    const mimic = makeBattleUnit({ id: "mimicking_flesh", name: "模倣する粘肉", atk: 4, hp: 3 });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const board = [mimic, graft];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    // mimic at pos 0 does nothing; graft absorbs mimic
    expect(board).toHaveLength(1);
    expect(board[0]).toBe(graft);
    expect(graft.atk).toBe(3 + 4);
    expect(graft.hp).toBe(6 + 3);
    const absorbed = ctx.absorbedUnits.get(graft.uid)!;
    expect(absorbed.id).toBe("mimicking_flesh");
    // Kill graft → re-spawns mimicking_flesh
    graft.hp = 0;
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.name).toBe("模倣する粘肉");
    expect(ctx.pBoard[0]!.atk).toBe(Math.floor(4 * 0.5));
    expect(ctx.pBoard[0]!.hp).toBe(Math.max(1, Math.floor(3 * 0.5)));
  });

  it("multiple grafts chain: B absorbs A after A absorbs rat", () => {
    const rat = makeBattleUnit({ id: "rat", name: "疫病ネズミ", atk: 2, hp: 1 });
    const graftA = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const graftB = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 5, hp: 4 });
    const board = [rat, graftA, graftB];
    const ctx = makeContext(board, []);
    runStartSkills(board, [], true, ctx);
    // A absorbs rat → board = [A, B] → B absorbs A
    expect(board).toHaveLength(1);
    expect(board[0]).toBe(graftB);
    expect(graftB.atk).toBe(5 + (3 + 2));
    expect(graftB.hp).toBe(4 + (6 + 1));
    // B stored A's data; A stored rat's data (orphaned but harmless)
    const absorbedByB = ctx.absorbedUnits.get(graftB.uid)!;
    expect(absorbedByB.id).toBe("devouring_graft");
    expect(absorbedByB.atk).toBe(3 + 2);
    // Kill B → A is re-spawned with 50% decayed stats
    graftB.hp = 0;
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.name).toBe("貪る接合体");
    expect(ctx.pBoard[0]!.atk).toBe(Math.floor((3 + 2) * 0.5));
    expect(ctx.pBoard[0]!.hp).toBe(Math.max(1, Math.floor((6 + 1) * 0.5)));
  });
});

// ── devouring_graft: 再召喚レベルはgraft自身のレベルに依存（SAP Whale準拠） ──

describe("devouring_graft – resummon inherits graft level", () => {
  it("Lv2 graft re-spawns absorbed unit at level 2", () => {
    const pred = makeBattleUnit({ id: "rat", name: "疫病ネズミ", atk: 5, hp: 3 });
    const graft = makeBattleUnit({
      id: "devouring_graft",
      name: "貪る接合体",
      atk: 3,
      hp: 6,
      level: 2,
    });
    const pBoard = [pred, graft];
    const ctx = makeContext(pBoard, []);
    runStartSkills(ctx.pBoard, [], true, ctx);
    expect(ctx.pBoard).toHaveLength(1);
    ctx.pBoard[0]!.hp = 0;
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.level).toBe(2);
  });

  it("Lv2 graft re-spawns cholera with correct skillUses", () => {
    const cholera = makeBattleUnit({ id: "cholera", name: "コレラ", atk: 3, hp: 3 });
    const graft = makeBattleUnit({
      id: "devouring_graft",
      name: "貪る接合体",
      atk: 3,
      hp: 6,
      level: 2,
    });
    const pBoard = [cholera, graft];
    const ctx = makeContext(pBoard, []);
    runStartSkills(ctx.pBoard, [], true, ctx);
    expect(ctx.pBoard).toHaveLength(1);
    ctx.pBoard[0]!.hp = 0;
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    const spawned = ctx.pBoard[0]!;
    expect(spawned.id).toBe("cholera");
    expect(spawned.level).toBe(2);
    expect(spawned.skillUses).toBe(atLevel(CHOLERA.uses, 2));
  });

  it("Lv1 graft re-spawns at level 1 (default)", () => {
    const pred = makeBattleUnit({ id: "rat", name: "疫病ネズミ", atk: 5, hp: 3 });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const pBoard = [pred, graft];
    const ctx = makeContext(pBoard, []);
    runStartSkills(ctx.pBoard, [], true, ctx);
    ctx.pBoard[0]!.hp = 0;
    resolveDeaths(ctx);
    expect(ctx.pBoard[0]!.level).toBe(1);
  });
});
