import { ITEMS } from "../shared/data/items";
import type { UnitId, UnitInstance, ShopItemSlot } from "../shared/types";
import type { Rng } from "./rng";
import { effectiveAtk, effectiveHp } from "../shared/unit-stats";
import { invariant } from "../shared/invariant";
import { CUMULATIVE_EXP, MAX_UNIT_LEVEL } from "../shared/constants";
import { atLevel, ALTAR, ROT_RING, CHALICE, GUT_HAND, NESTING_GRUB } from "../shared/skill-params";
import { getSkillText } from "../shared/skill-text";
import { buffRandomUnit, computeZealotBuff } from "./buff-utils";

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
      tempBuffAtk: 0,
      exp: newExp,
      level: newLevel,
      skillText: getSkillText(base.id, newLevel),
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
  let totalAtkBuff = 0;
  let totalHpBuff = 0;
  board.forEach((u) => {
    if (u && u.id === "rot_ring") {
      totalMaxUses += atLevel(ROT_RING.uses, u.level);
      const b = atLevel(ROT_RING.buff, u.level);
      totalAtkBuff += b.atk;
      totalHpBuff += b.hp;
    }
  });
  if (totalAtkBuff === 0 && totalHpBuff === 0) return { board, rotRingUses };
  if (rotRingUses >= totalMaxUses) return { board, rotRingUses };
  return {
    board: board.map((bu) =>
      bu
        ? {
            ...bu,
            buffAtk: bu.buffAtk + totalAtkBuff,
            buffHp: bu.buffHp + totalHpBuff,
          }
        : null,
    ),
    rotRingUses: rotRingUses + 1,
  };
}

interface BuyResult {
  board: (UnitInstance | null)[];
  chaliceLevel: number | null;
  rotRingUses: number;
}

export const applyBuyEffects = (
  boughtUnit: UnitInstance,
  currentBoard: (UnitInstance | null)[],
  rotRingUses: number,
  rng: Rng,
  placedIndex: number,
): BuyResult => {
  const rotRing = applyRotRingBuff(boughtUnit, currentBoard, rotRingUses);
  const board = rotRing.board;
  applyGutHandBuyBuff(board, boughtUnit.id, rng, placedIndex);
  return {
    board,
    chaliceLevel: boughtUnit.id === "chalice" ? boughtUnit.level : null,
    rotRingUses: rotRing.rotRingUses,
  };
};

function applyGutHandBuyBuff(
  board: (UnitInstance | null)[],
  boughtId: UnitId,
  rng: Rng,
  placedIndex: number,
): void {
  if (boughtId !== "gut_hand") return;
  const u = board[placedIndex];
  if (!u) return;
  const targets = atLevel(GUT_HAND.targets, u.level);
  for (let i = 0; i < targets; i++) {
    buffRandomUnit(board, 0, GUT_HAND.hpBuff, rng, placedIndex);
  }
}

export const applyChaliceEffect = (
  shopItems: (ShopItemSlot | null)[],
  level: number,
): (ShopItemSlot | null)[] => {
  const item = ITEMS[atLevel(CHALICE.itemId, level)];
  const result: (ShopItemSlot | null)[] = shopItems.map(() => null);
  for (let i = 0; i < Math.min(2, result.length); i++) {
    result[i] = { item, frozen: false };
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
      tempBuffAtk: current.tempBuffAtk + zealotCount,
    };
    modified = true;
  }

  return modified ? nextBoard : currentBoard;
};

export { applySellEffects } from "./shop-effects-sell";

export function applyLevelUpEffects(
  board: (UnitInstance | null)[],
  leveledIndex: number,
  rng: Rng,
): void {
  const unit = board[leveledIndex];
  if (!unit || unit.id !== "nesting_grub") return;
  const prevLevel = unit.level - 1;
  const b = atLevel(NESTING_GRUB.buff, prevLevel);
  if (b.atk === 0 && b.hp === 0) return;
  for (let i = 0; i < NESTING_GRUB.targets; i++) {
    buffRandomUnit(board, b.atk, b.hp, rng, leveledIndex);
  }
}
