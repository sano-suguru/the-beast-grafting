import { applyAshFungusBuff, applyCatacombRatBuff, applyRevenantBuff } from "./shop-effects-setup";
import { makeUnit } from "./test-helpers";
import { createSeededRng } from "./rng";
import type { BoardUnit } from "../shared/board-unit";
import { CATACOMB_RAT, REVENANT, atLevel } from "../shared/skill-params";

function makeBU(overrides: Parameters<typeof makeUnit>[0] = {}): BoardUnit {
  return makeUnit(overrides) as unknown as BoardUnit;
}

describe("applyAshFungusBuff – ash_fungus (Penguin)", () => {
  it("buffs 2 random Lv2+ allies with +1/+1 (Lv1)", () => {
    const fungus = makeBU({ id: "ash_fungus", uid: "f1" });
    const lv2a = makeBU({ level: 2, uid: "a1", buffAtk: 0, buffHp: 0 });
    const lv2b = makeBU({ level: 2, uid: "a2", buffAtk: 0, buffHp: 0 });
    const board: (BoardUnit | null)[] = [fungus, lv2a, lv2b, null, null];
    applyAshFungusBuff(board, createSeededRng(1));
    const buffed = board
      .filter((u): u is BoardUnit => u !== null && u.uid !== "f1")
      .filter((u) => u.buffAtk > 0);
    expect(buffed).toHaveLength(2);
    buffed.forEach((u) => {
      expect(u.buffAtk).toBe(1);
      expect(u.buffHp).toBe(1);
    });
  });

  it("buffs only 1 when only 1 Lv2+ ally present", () => {
    const fungus = makeBU({ id: "ash_fungus", uid: "f1" });
    const lv2 = makeBU({ level: 2, uid: "a1", buffAtk: 0, buffHp: 0 });
    const lv1 = makeBU({ level: 1, uid: "a2", buffAtk: 0, buffHp: 0 });
    const board: (BoardUnit | null)[] = [fungus, lv2, lv1, null, null];
    applyAshFungusBuff(board, createSeededRng(1));
    expect((board[1] as BoardUnit).buffAtk).toBe(1);
    expect((board[2] as BoardUnit).buffAtk).toBe(0);
  });

  it("does not buff Lv1 allies", () => {
    const fungus = makeBU({ id: "ash_fungus", uid: "f1" });
    const lv1a = makeBU({ level: 1, uid: "a1", buffAtk: 0, buffHp: 0 });
    const lv1b = makeBU({ level: 1, uid: "a2", buffAtk: 0, buffHp: 0 });
    const board: (BoardUnit | null)[] = [fungus, lv1a, lv1b, null, null];
    applyAshFungusBuff(board, createSeededRng(1));
    expect((board[1] as BoardUnit).buffAtk).toBe(0);
    expect((board[2] as BoardUnit).buffAtk).toBe(0);
  });
});

describe("applyCatacombRatBuff – 前方方向の保証", () => {
  const lv1Atk = atLevel(CATACOMB_RAT.atkBuff, 1);

  it("rat が index 0 にいるときは前方が空なので誰にもバフしない", () => {
    const rat = makeBU({ id: "catacomb_rat", uid: "r1" });
    const a1 = makeBU({ uid: "a1", buffAtk: 0 });
    const a2 = makeBU({ uid: "a2", buffAtk: 0 });
    const a3 = makeBU({ uid: "a3", buffAtk: 0 });
    const board: (BoardUnit | null)[] = [rat, a1, a2, a3, null];
    applyCatacombRatBuff(board, "LOSE");
    expect((board[1] as BoardUnit).buffAtk).toBe(0);
    expect((board[2] as BoardUnit).buffAtk).toBe(0);
    expect((board[3] as BoardUnit).buffAtk).toBe(0);
  });

  it("rat が index 2 にいるときは index 0,1 のみバフする（後方は無視）", () => {
    const front1 = makeBU({ uid: "f1", buffAtk: 0 });
    const front2 = makeBU({ uid: "f2", buffAtk: 0 });
    const rat = makeBU({ id: "catacomb_rat", uid: "r1" });
    const back1 = makeBU({ uid: "b1", buffAtk: 0 });
    const back2 = makeBU({ uid: "b2", buffAtk: 0 });
    const board: (BoardUnit | null)[] = [front1, front2, rat, back1, back2];
    applyCatacombRatBuff(board, "LOSE");
    expect((board[0] as BoardUnit).buffAtk).toBe(lv1Atk);
    expect((board[1] as BoardUnit).buffAtk).toBe(lv1Atk);
    expect((board[3] as BoardUnit).buffAtk).toBe(0);
    expect((board[4] as BoardUnit).buffAtk).toBe(0);
  });

  it("rat が index 4 にいるときは最大 3 体（0,1,2）のみバフする", () => {
    const f0 = makeBU({ uid: "f0", buffAtk: 0 });
    const f1 = makeBU({ uid: "f1", buffAtk: 0 });
    const f2 = makeBU({ uid: "f2", buffAtk: 0 });
    const f3 = makeBU({ uid: "f3", buffAtk: 0 });
    const rat = makeBU({ id: "catacomb_rat", uid: "r1" });
    const board: (BoardUnit | null)[] = [f0, f1, f2, f3, rat];
    applyCatacombRatBuff(board, "LOSE");
    expect((board[0] as BoardUnit).buffAtk).toBe(0);
    expect((board[1] as BoardUnit).buffAtk).toBe(lv1Atk);
    expect((board[2] as BoardUnit).buffAtk).toBe(lv1Atk);
    expect((board[3] as BoardUnit).buffAtk).toBe(lv1Atk);
  });

  it("前回が LOSE でないときはバフしない", () => {
    const rat = makeBU({ id: "catacomb_rat", uid: "r1" });
    const ally = makeBU({ uid: "a1", buffAtk: 0 });
    const board: (BoardUnit | null)[] = [ally, rat, null, null, null];
    applyCatacombRatBuff(board, "WIN");
    expect((board[0] as BoardUnit).buffAtk).toBe(0);
  });
});

describe("applyRevenantBuff – 前方方向の保証", () => {
  const buff = REVENANT.buff;

  it("revenant が index 0 にいるときは誰にもバフしない", () => {
    const rev = makeBU({ id: "revenant", uid: "rv1" });
    const a1 = makeBU({ uid: "a1", buffAtk: 0, buffHp: 0 });
    const board: (BoardUnit | null)[] = [rev, a1, null, null, null];
    applyRevenantBuff(board);
    expect((board[1] as BoardUnit).buffAtk).toBe(0);
    expect((board[1] as BoardUnit).buffHp).toBe(0);
  });

  it("revenant が index 3 にいるときは index 2,1 のみバフする（REVENANT.targets=2 を想定）", () => {
    const f0 = makeBU({ uid: "f0", buffAtk: 0, buffHp: 0 });
    const f1 = makeBU({ uid: "f1", buffAtk: 0, buffHp: 0 });
    const f2 = makeBU({ uid: "f2", buffAtk: 0, buffHp: 0 });
    const rev = makeBU({ id: "revenant", uid: "rv1" });
    const board: (BoardUnit | null)[] = [f0, f1, f2, rev, null];
    applyRevenantBuff(board);
    const targets = atLevel(REVENANT.targets, 1);
    expect((board[2] as BoardUnit).buffAtk).toBe(buff.atk);
    expect((board[1] as BoardUnit).buffAtk).toBe(targets >= 2 ? buff.atk : 0);
    expect((board[0] as BoardUnit).buffAtk).toBe(targets >= 3 ? buff.atk : 0);
  });
});
