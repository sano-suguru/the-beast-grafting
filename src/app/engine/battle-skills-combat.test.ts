import { applyAcidSplash, processHundredArmsKnockout } from "./battle-skills-combat";
import { makeBattleUnit, makeContext } from "./test-helpers";

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
  it("hundred_arms deals 4 damage to front enemy after knockout", () => {
    const hundredArms = makeBattleUnit({ id: "hundred_arms", atk: 6, hp: 7 });
    const enemy1 = makeBattleUnit({ hp: 10, tier: 3 });
    const enemy2 = makeBattleUnit({ hp: 10, tier: 3 });
    const attackerBoard = [hundredArms];
    const defenderBoard = [enemy1, enemy2];
    const ctx = makeContext(attackerBoard, defenderBoard);
    processHundredArmsKnockout(hundredArms, defenderBoard, attackerBoard, true, ctx);
    expect(defenderBoard[0]!.hp).toBe(6);
  });

  it("hundred_arms deals 8 damage to tier 1 enemy", () => {
    const hundredArms = makeBattleUnit({ id: "hundred_arms", atk: 6, hp: 7 });
    const enemy1 = makeBattleUnit({ hp: 20, tier: 1 });
    const enemy2 = makeBattleUnit({ hp: 10 });
    const attackerBoard = [hundredArms];
    const defenderBoard = [enemy1, enemy2];
    const ctx = makeContext(attackerBoard, defenderBoard);
    processHundredArmsKnockout(hundredArms, defenderBoard, attackerBoard, true, ctx);
    expect(defenderBoard[0]!.hp).toBe(12);
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
});
