import { ITEMS } from "../shared/data/items";
import type { UnitInstance, ShopItemSlot } from "../shared/types";
import { effectiveAtk, effectiveHp } from "../shared/unit-stats";
import { invariant } from "../shared/invariant";
import { CUMULATIVE_EXP, MAX_UNIT_LEVEL } from "../shared/constants";
import { atLevel, ALTAR, MACHINE, ROT_RING } from "../shared/skill-params";
import { getSkillText } from "../shared/skill-text";
import { computeZealotBuff } from "./buff-utils";

interface GraftResult {
  unit: UnitInstance;
  leveledUp: boolean;
}

export const graftUnits = (base: UnitInstance, material: UnitInstance): GraftResult => {
  const maxExp = CUMULATIVE_EXP[MAX_UNIT_LEVEL];
  const newExp = Math.min(base.exp + 1, maxExp);
  const nextLevel = Math.min(MAX_UNIT_LEVEL, base.level + 1);
  invariant(nextLevel === 2 || nextLevel === 3, `unexpected nextLevel: ${nextLevel}`);
  const threshold = CUMULATIVE_EXP[nextLevel] ?? Infinity;
  const newLevel = newExp >= threshold ? nextLevel : base.level;
  const leveledUp = newLevel > base.level;

  const maxAtk = Math.max(effectiveAtk(base), effectiveAtk(material));
  const maxHp = Math.max(effectiveHp(base), effectiveHp(material));

  return {
    unit: {
      ...base,
      baseAtk: maxAtk + 1,
      baseHp: maxHp + 1,
      buffAtk: 0,
      buffHp: 0,
      exp: newExp,
      level: newLevel,
      skillText: getSkillText(base.id, newLevel, base.skillText),
    },
    leveledUp,
  };
};

function applyRotRingBuff(
  boughtUnit: UnitInstance,
  board: (UnitInstance | null)[],
  rotRingUses: number,
): { board: (UnitInstance | null)[]; rotRingUses: number } {
  if (boughtUnit.tier !== 1) return { board, rotRingUses };
  let totalMaxUses = 0;
  let rotRingCount = 0;
  board.forEach((u) => {
    if (u && u.id === "rot_ring") {
      rotRingCount += 1;
      totalMaxUses += atLevel(ROT_RING.uses, u.level);
    }
  });
  if (rotRingCount === 0) return { board, rotRingUses };
  if (rotRingUses >= totalMaxUses) return { board, rotRingUses };
  return {
    board: board.map((bu) =>
      bu
        ? {
            ...bu,
            buffAtk: bu.buffAtk + rotRingCount,
            buffHp: bu.buffHp + rotRingCount,
          }
        : null,
    ),
    rotRingUses: rotRingUses + 1,
  };
}

export const applyBuyEffects = (
  boughtUnit: UnitInstance,
  currentBoard: (UnitInstance | null)[],
  rotRingUses = 0,
): { board: (UnitInstance | null)[]; chaliceTriggered: boolean; rotRingUses: number } => {
  const rotRing = applyRotRingBuff(boughtUnit, currentBoard, rotRingUses);
  return {
    board: rotRing.board,
    chaliceTriggered: boughtUnit.id === "chalice",
    rotRingUses: rotRing.rotRingUses,
  };
};

export const applyChaliceEffect = (shopItems: (ShopItemSlot | null)[]): (ShopItemSlot | null)[] => {
  const pureBlood = ITEMS["pure_blood"];
  if (!pureBlood) return shopItems;
  const result: (ShopItemSlot | null)[] = shopItems.map(() => null);
  for (let i = 0; i < Math.min(2, result.length); i++) {
    result[i] = { item: pureBlood, frozen: false };
  }
  return result;
};

export const applySummonEffects = (
  summonedUnitIndex: number,
  currentBoard: (UnitInstance | null)[],
): (UnitInstance | null)[] => {
  const nextBoard = [...currentBoard];
  let modified = false;

  const target = nextBoard[summonedUnitIndex];
  if (!target) return currentBoard;

  let altarAtkBuff = 0;
  let altarHpBuff = 0;
  nextBoard.forEach((u) => {
    if (!u || u.id !== "altar") return;
    const ab = atLevel(ALTAR.buff, u.level);
    altarAtkBuff += ab.atk;
    altarHpBuff += ab.hp;
  });
  if (altarAtkBuff > 0 || altarHpBuff > 0) {
    nextBoard[summonedUnitIndex] = {
      ...target,
      buffAtk: target.buffAtk + altarAtkBuff,
      buffHp: target.buffHp + altarHpBuff,
    };
    modified = true;
  }

  const zealotCount = computeZealotBuff(
    nextBoard.filter((u): u is UnitInstance => u !== null),
    { requireAlive: false },
  );
  if (zealotCount > 0) {
    const current = nextBoard[summonedUnitIndex] ?? target;
    nextBoard[summonedUnitIndex] = {
      ...current,
      buffAtk: current.buffAtk + zealotCount,
    };
    modified = true;
  }

  return modified ? nextBoard : currentBoard;
};

export const applyEndOfTurnEffects = (
  currentBoard: (UnitInstance | null)[],
): (UnitInstance | null)[] => {
  const nextBoard = [...currentBoard];
  let modified = false;

  // SAP: Monkey相当
  const frontIdx = nextBoard.findIndex((u) => u !== null);
  if (frontIdx !== -1) {
    nextBoard.forEach((u) => {
      if (!u || u.id !== "machine") return;
      modified = true;
      const front = nextBoard[frontIdx];
      if (!front) return;
      const mb = atLevel(MACHINE.buff, u.level);
      nextBoard[frontIdx] = {
        ...front,
        buffAtk: front.buffAtk + mb.atk,
        buffHp: front.buffHp + mb.hp,
      };
    });
  }

  return modified ? nextBoard : currentBoard;
};
