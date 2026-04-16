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
import { atLevel, CHOLERA } from "../shared/skill-params";
import { BUDDING_HYDRA } from "../shared/skill-params-shop";
import { OMEN_WOMB, STELLAR_COCOON } from "../shared/skill-params-death";

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
    callHandler("budding_hydra", hydra, board, 0, true, ctx);
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
    callHandler("budding_hydra", hydra, board, 0, true, ctx);
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
    callHandler("budding_hydra", hydra, board, 0, true, ctx);
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
    callHandler("budding_hydra", hydra, board, 0, true, ctx);
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
    callHandler("budding_hydra", hydra, board, 0, true, ctx);
    expect(board.length).toBeLessThanOrEqual(MAX_BOARD_SIZE);
    expect(board.filter((u) => u.name === "ヒドラの首").length).toBe(MAX_BOARD_SIZE - 3);
  });
});

describe("handleGraftScionDeath", () => {
  it("transfers dead ATK to successor", () => {
    const successor = makeBattleUnit({ id: INERT_UNIT_ID, atk: 3, hp: 5 });
    const board = [successor];
    const dead = makeBattleUnit({ id: "graft_scion", name: "接ぎ穂の残骸", atk: 4, hp: 0 });
    const ctx = makeContext(board, []);
    callHandler("graft_scion", dead, board, 0, true, ctx, successor);
    expect(successor.atk).toBe(3 + 4);
    expect(ctx.frames).toHaveLength(1);
  });

  it("does nothing without successor", () => {
    const board: BattleUnit[] = [];
    const dead = makeBattleUnit({ id: "graft_scion", name: "接ぎ穂の残骸", atk: 4, hp: 0 });
    const ctx = makeContext(board, []);
    callHandler("graft_scion", dead, board, 0, true, ctx, null);
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
  it("spawns star_child unit with correct stats", () => {
    const board: BattleUnit[] = [];
    const dead = makeBattleUnit({ id: "stellar_cocoon", name: "星辰の繭", atk: 4, hp: 0 });
    const ctx = makeContext(board, []);
    callHandler("stellar_cocoon", dead, board, 0, true, ctx);
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
    callHandler("star_child", child, ctx.pBoard, 0, true, ctx);
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
    callHandler("star_child", child, ctx.pBoard, 0, true, ctx);
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
    callHandler("star_child", child, ctx.pBoard, 0, true, ctx);
    expect(ctx.frames).toHaveLength(0);
  });

  it("does nothing when no lastDamageSource", () => {
    const child = makeBattleUnit({ id: "star_child", name: "星の落とし子", hp: 0 });
    const enemy = makeBattleUnit({ uid: "e1", atk: 5, hp: 10 });
    const ctx = makeContext([], [enemy], null, { next: () => 0 });
    callHandler("star_child", child, ctx.pBoard, 0, true, ctx);
    expect(ctx.frames).toHaveLength(0);
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
    const handler = getDeathHandler("devouring_graft" as DeathHandlerUnitId);
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
