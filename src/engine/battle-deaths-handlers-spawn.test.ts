import { getDeathHandler } from "./battle-deaths-handlers";
import type { DeathHandlerUnitId } from "./battle-deaths-handlers";
import {
  INERT_UNIT_ID,
  makeBattleUnit,
  makeContext,
  callDeathHandler as callHandler,
} from "./test-helpers";
import type { BattleUnit } from "./battle-context";
import { invariant } from "../shared/invariant";
import { resolveDeaths } from "./battle-deaths";
import { runStartSkills } from "./battle-skills";
import { MAX_BOARD_SIZE } from "./constants";
import { atLevel } from "../shared/skill-params";
import { MAMMOTH } from "../shared/skill-params";
import { OMEN_WOMB, GROANING_COFFIN, DEVOURING_WOUND } from "../shared/skill-params-death";

describe("budding_hydra (Mammoth) – death buffs full board", () => {
  it("buffs every ally on death by MAMMOTH.buff", () => {
    const hydra = makeBattleUnit({
      id: "budding_hydra",
      name: "肉芽のヒドラ",
      atk: 3,
      hp: 0,
      preDeathHp: 10,
    });
    const a1 = makeBattleUnit({ atk: 2, hp: 3 });
    const a2 = makeBattleUnit({ atk: 1, hp: 5 });
    const board: BattleUnit[] = [a1, a2];
    const ctx = makeContext(board, []);
    callHandler("budding_hydra", hydra, board, 0, true, ctx);
    const b = atLevel(MAMMOTH.buff, 1);
    expect(a1.atk).toBe(2 + b.atk);
    expect(a1.hp).toBe(3 + b.hp);
    expect(a2.atk).toBe(1 + b.atk);
    expect(a2.hp).toBe(5 + b.hp);
  });

  it("does nothing on empty board", () => {
    const hydra = makeBattleUnit({
      id: "budding_hydra",
      atk: 3,
      hp: 0,
      preDeathHp: 10,
    });
    const board: BattleUnit[] = [];
    const ctx = makeContext(board, []);
    callHandler("budding_hydra", hydra, board, 0, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });
});

describe("handleOmenWombDeath", () => {
  it("spawns 2 tokens with correct stats", () => {
    const board: BattleUnit[] = [];
    const dead = makeBattleUnit({ id: "omen_womb", name: "忌み腹の屍", atk: 2, hp: 0 });
    const ctx = makeContext(board, []);
    callHandler("omen_womb", dead, board, 0, true, ctx);
    const t = atLevel(OMEN_WOMB.token, 1);
    const tokens = board.filter((u) => u.name === "忌み子");
    expect(tokens).toHaveLength(2);
    expect(tokens[0]!.atk).toBe(t.atk);
    expect(tokens[0]!.hp).toBe(t.hp);
  });
});

describe("handleStellarCocoonDeath", () => {
  it("レベル数の落とし子をATK×50%(HP1)で召喚する", () => {
    const board: BattleUnit[] = [];
    const dead = makeBattleUnit({
      id: "stellar_cocoon",
      name: "星辰の繭",
      atk: 6,
      hp: 0,
      level: 2,
    });
    const ctx = makeContext(board, []);
    callHandler("stellar_cocoon", dead, board, 0, true, ctx);
    const children = board.filter((u) => u.id === "token");
    expect(children).toHaveLength(2); // level 2 → 2体
    expect(children[0]!.atk).toBe(3); // ceil(6/2) = 3
    expect(children[0]!.hp).toBe(1);
  });

  it("ATK奇数のとき切り上げで計算する", () => {
    const board: BattleUnit[] = [];
    const dead = makeBattleUnit({
      id: "stellar_cocoon",
      name: "星辰の繭",
      atk: 5,
      hp: 0,
      level: 1,
    });
    const ctx = makeContext(board, []);
    callHandler("stellar_cocoon", dead, board, 0, true, ctx);
    const children = board.filter((u) => u.id === "token");
    expect(children).toHaveLength(1);
    expect(children[0]!.atk).toBe(3); // ceil(5/2) = 3
    expect(children[0]!.hp).toBe(1);
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
    expect(ctx.pBoard[0]!.atk).toBe(3); // no stat gain on SoB
    // Kill graft
    ctx.pBoard[0]!.hp = 0;
    resolveDeaths(ctx);
    // Absorbed unit re-spawns with base stats from lookupUnitData
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.name).toBe("疫病ネズミ");
    expect(ctx.pBoard[0]!.atk).toBe(2); // rat baseAtk
    expect(ctx.pBoard[0]!.hp).toBe(2); // rat baseHp
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
    expect(ctx.pBoard[0]!.atk).toBe(3); // no stat gain on SoB
    ctx.pBoard[0]!.hp = 0;
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.name).toBe("見習い従騎士");
    expect(ctx.pBoard[0]!.atk).toBe(1); // squire baseAtk
    expect(ctx.pBoard[0]!.hp).toBe(2); // squire baseHp
  });

  it("re-spawns absorbed token on death", () => {
    const token = makeBattleUnit({ id: INERT_UNIT_ID, name: "肉塊", atk: 4, hp: 3 });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const pBoard = [token, graft];
    const ctx = makeContext(pBoard, []);
    runStartSkills(ctx.pBoard, [], true, ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.atk).toBe(3); // no stat gain on SoB
    ctx.pBoard[0]!.hp = 0;
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.id).toBe("token");
    expect(ctx.pBoard[0]!.name).toBe("肉塊");
    expect(ctx.pBoard[0]!.atk).toBe(4); // token uses stored live stats
    expect(ctx.pBoard[0]!.hp).toBe(3); // token uses stored live stats
  });

  it("does nothing if no absorbed data", () => {
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 0 });
    const board: BattleUnit[] = [];
    const ctx = makeContext(board, []);
    const handler = getDeathHandler("devouring_graft" as DeathHandlerUnitId);
    invariant(handler, "handler must exist");
    handler({ dead: graft, board, idx: 0, isPlayer: true, ctx, successor: null, successor2: null });
    expect(board).toHaveLength(0);
    expect(ctx.frames).toHaveLength(0);
  });

  it("preserves absorbed unit equipment on re-summon", () => {
    const pred = makeBattleUnit({
      id: "rat",
      name: "疫病ネズミ",
      atk: 5,
      hp: 3,
      equip: "iron_plate",
    });
    const graft = makeBattleUnit({ id: "devouring_graft", name: "貪る接合体", atk: 3, hp: 6 });
    const pBoard = [pred, graft];
    const ctx = makeContext(pBoard, []);
    runStartSkills(ctx.pBoard, [], true, ctx);
    expect(ctx.pBoard).toHaveLength(1);
    ctx.pBoard[0]!.hp = 0;
    resolveDeaths(ctx);
    expect(ctx.pBoard).toHaveLength(1);
    expect(ctx.pBoard[0]!.name).toBe("疫病ネズミ");
    expect(ctx.pBoard[0]!.equip).toBe("iron_plate");
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

  it("Lv2 graft re-spawns unit with correct skillUses", () => {
    const cholera = makeBattleUnit({ id: "cholera", name: "コレラ", atk: 3, hp: 3, skillUses: 3 });
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
    expect(spawned.skillUses).toBe(0);
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

describe("handleDevouringWoundDeath – spawns tokens on enemy board", () => {
  it("spawns 1/1 token on enemy board (Lv1)", () => {
    const dead = makeBattleUnit({ id: "devouring_wound", name: "喰い傷", atk: 3, hp: 0 });
    const board: BattleUnit[] = [];
    const eBoard: BattleUnit[] = [];
    const ctx = makeContext(board, eBoard);
    callHandler("devouring_wound", dead, board, 0, true, ctx);
    expect(ctx.eBoard).toHaveLength(1);
    expect(ctx.eBoard[0]!.atk).toBe(DEVOURING_WOUND.token.atk);
    expect(ctx.eBoard[0]!.hp).toBe(DEVOURING_WOUND.token.hp);
  });

  it("spawns 2 tokens at Lv2", () => {
    const dead = makeBattleUnit({ id: "devouring_wound", name: "喰い傷", atk: 3, hp: 0, level: 2 });
    const board: BattleUnit[] = [];
    const eBoard: BattleUnit[] = [];
    const ctx = makeContext(board, eBoard);
    callHandler("devouring_wound", dead, board, 0, true, ctx);
    expect(ctx.eBoard).toHaveLength(2);
  });

  it("does not spawn when enemy board is at MAX_BOARD_SIZE", () => {
    const dead = makeBattleUnit({ id: "devouring_wound", name: "喰い傷", atk: 3, hp: 0 });
    const board: BattleUnit[] = [];
    const eBoard = Array.from({ length: MAX_BOARD_SIZE }, () => makeBattleUnit({ hp: 5 }));
    const ctx = makeContext(board, eBoard);
    callHandler("devouring_wound", dead, board, 0, true, ctx);
    expect(ctx.eBoard).toHaveLength(MAX_BOARD_SIZE);
  });
});

describe("handleGroaningCoffinDeath – death spawn with acid_blood", () => {
  it("spawns 5/3 token with acid_blood (Lv1)", () => {
    const coffin = makeBattleUnit({ id: "groaning_coffin", name: "呻く棺", atk: 2, hp: 0 });
    const board: BattleUnit[] = [];
    const ctx = makeContext(board, []);
    callHandler("groaning_coffin", coffin, board, 0, true, ctx);
    const t = atLevel(GROANING_COFFIN.token, 1);
    expect(board).toHaveLength(1);
    expect(board[0]!.atk).toBe(t.atk);
    expect(board[0]!.hp).toBe(t.hp);
    expect(board[0]!.equip).toBe("acid_blood");
  });

  it("spawns 10/6 token at Lv2", () => {
    const coffin = makeBattleUnit({
      id: "groaning_coffin",
      name: "呻く棺",
      atk: 2,
      hp: 0,
      level: 2,
    });
    const board: BattleUnit[] = [];
    const ctx = makeContext(board, []);
    callHandler("groaning_coffin", coffin, board, 0, true, ctx);
    const t = atLevel(GROANING_COFFIN.token, 2);
    expect(board[0]!.atk).toBe(t.atk);
    expect(board[0]!.hp).toBe(t.hp);
    expect(board[0]!.equip).toBe("acid_blood");
  });

  it("does not spawn when board is at MAX_BOARD_SIZE", () => {
    const filler = Array.from({ length: MAX_BOARD_SIZE }, () => makeBattleUnit({ hp: 5 }));
    const coffin = makeBattleUnit({ id: "groaning_coffin", name: "呻く棺", atk: 2, hp: 0 });
    const board: BattleUnit[] = [...filler];
    const ctx = makeContext(board, []);
    callHandler("groaning_coffin", coffin, board, 0, true, ctx);
    expect(board).toHaveLength(MAX_BOARD_SIZE);
  });
});
