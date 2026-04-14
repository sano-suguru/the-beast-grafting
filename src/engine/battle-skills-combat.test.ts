import { applyAcidSplash, processHundredArmsKnockout } from "./battle-skills-combat";
import { makeBattleUnit, makeContext, INERT_UNIT_ID } from "./test-helpers";

describe("applyAcidSplash", () => {
  it("deals 5 damage to second enemy unit", () => {
    const attacker = makeBattleUnit({ equip: "acid", atk: 3, hp: 3 });
    const front = makeBattleUnit({ hp: 10 });
    const second = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([attacker], [front, second]);
    applyAcidSplash(attacker, ctx.eBoard, true, ctx);
    expect(second.hp).toBe(5);
  });

  it("does nothing if attacker has no acid equip", () => {
    const attacker = makeBattleUnit({ equip: null });
    const second = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([attacker], [makeBattleUnit(), second]);
    applyAcidSplash(attacker, ctx.eBoard, true, ctx);
    expect(second.hp).toBe(10);
  });

  it("does nothing if only one enemy", () => {
    const attacker = makeBattleUnit({ equip: "acid" });
    const single = makeBattleUnit({ hp: 10 });
    const ctx = makeContext([attacker], [single]);
    applyAcidSplash(attacker, ctx.eBoard, true, ctx);
    expect(single.hp).toBe(10);
  });
});

describe("processHundredArmsKnockout", () => {
  it("hundred_arms deals 3 damage to front enemy after knockout", () => {
    const hundredArms = makeBattleUnit({ id: "hundred_arms", atk: 6, hp: 7 });
    const enemy1 = makeBattleUnit({ hp: 10, tier: 3 });
    const enemy2 = makeBattleUnit({ hp: 10, tier: 3 });
    const attackerBoard = [hundredArms];
    const defenderBoard = [enemy1, enemy2];
    const ctx = makeContext(attackerBoard, defenderBoard);
    processHundredArmsKnockout(hundredArms, defenderBoard, attackerBoard, true, ctx);
    expect(defenderBoard[0]!.hp).toBe(7);
  });

  it("hundred_arms deals 8 damage to tier 1 enemy", () => {
    const hundredArms = makeBattleUnit({ id: "hundred_arms", atk: 6, hp: 7 });
    const enemy1 = makeBattleUnit({ hp: 20, tier: 1 });
    const enemy2 = makeBattleUnit({ hp: 10 });
    const attackerBoard = [hundredArms];
    const defenderBoard = [enemy1, enemy2];
    const ctx = makeContext(attackerBoard, defenderBoard);
    processHundredArmsKnockout(hundredArms, defenderBoard, attackerBoard, true, ctx);
    expect(defenderBoard[0]!.hp).toBe(12); // 20 - 8 (T1 bonus damage)
  });

  it("does nothing if attacker is not hundred_arms", () => {
    const plain = makeBattleUnit({ id: "beast", atk: 6, hp: 7 });
    const enemy1 = makeBattleUnit({ hp: 10 });
    const enemy2 = makeBattleUnit({ hp: 10 });
    const attackerBoard = [plain];
    const defenderBoard = [enemy1, enemy2];
    const ctx = makeContext(attackerBoard, defenderBoard);
    processHundredArmsKnockout(plain, defenderBoard, attackerBoard, true, ctx);
    expect(defenderBoard[0]!.hp).toBe(10);
  });

  it("does nothing if attacker is dead", () => {
    const hundredArms = makeBattleUnit({ id: "hundred_arms", atk: 6, hp: 0 });
    const enemy1 = makeBattleUnit({ hp: 10 });
    const enemy2 = makeBattleUnit({ hp: 10 });
    const attackerBoard = [hundredArms];
    const defenderBoard = [enemy1, enemy2];
    const ctx = makeContext(attackerBoard, defenderBoard);
    processHundredArmsKnockout(hundredArms, defenderBoard, attackerBoard, true, ctx);
    expect(defenderBoard[0]!.hp).toBe(10);
  });

  it("kills front enemy and continues to damage next", () => {
    const hundredArms = makeBattleUnit({ id: "hundred_arms", atk: 6, hp: 7 });
    const weak = makeBattleUnit({ id: INERT_UNIT_ID, hp: 3, tier: 3, uid: "weak" });
    const strong = makeBattleUnit({ id: INERT_UNIT_ID, hp: 10, tier: 3, uid: "strong" });
    const attackerBoard = [hundredArms];
    const defenderBoard = [weak, strong];
    const ctx = makeContext(attackerBoard, defenderBoard);
    processHundredArmsKnockout(hundredArms, defenderBoard, attackerBoard, true, ctx);
    expect(defenderBoard.every((u) => u.uid !== "weak")).toBe(true);
    const remaining = defenderBoard.find((u) => u.uid === "strong");
    expect(remaining!.hp).toBe(7);
  });

  it("kills multiple consecutive weak enemies", () => {
    const hundredArms = makeBattleUnit({ id: "hundred_arms", atk: 6, hp: 7 });
    const e1 = makeBattleUnit({ id: INERT_UNIT_ID, hp: 1, tier: 3, uid: "e1" });
    const e2 = makeBattleUnit({ id: INERT_UNIT_ID, hp: 2, tier: 3, uid: "e2" });
    const e3 = makeBattleUnit({ id: INERT_UNIT_ID, hp: 20, tier: 3, uid: "e3" });
    const attackerBoard = [hundredArms];
    const defenderBoard = [e1, e2, e3];
    const ctx = makeContext(attackerBoard, defenderBoard);
    processHundredArmsKnockout(hundredArms, defenderBoard, attackerBoard, true, ctx);
    expect(defenderBoard.some((u) => u.uid === "e1")).toBe(false);
    expect(defenderBoard.some((u) => u.uid === "e2")).toBe(false);
    const e3Remaining = defenderBoard.find((u) => u.uid === "e3");
    expect(e3Remaining!.hp).toBe(17);
  });
});
