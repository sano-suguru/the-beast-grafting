import { ITEMS } from "../shared/data/items";
import type { BattleResult, UnitId, UnitInstance, ShopItemSlot } from "../shared/types";
import type { Rng } from "./rng";
import { effectiveAtk, effectiveHp } from "../shared/unit-stats";
import { invariant } from "../shared/invariant";
import { CUMULATIVE_EXP, MAX_UNIT_LEVEL } from "../shared/constants";
import {
  atLevel,
  ROT_RING,
  CHALICE,
  GUT_HAND,
  MACHINE,
  NESTING_GRUB,
  PARASITE,
  WAILING_CURSECHILD,
  CAT,
} from "../shared/skill-params";
import { getSkillText } from "../shared/skill-text";
import { buffRandomUnit, computeZealotBuff } from "./buff-utils";
import {
  type EndOfTurnHandler,
  handleAltarEndOfTurn,
  handleCatacombRatEndOfTurn,
  handleHangedManEndOfTurn,
} from "./shop-effects-end-of-turn";

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

function applyParasiteSummonBuff(
  nextBoard: (UnitInstance | null)[],
  summonedUnitIndex: number,
): boolean {
  let modified = false;
  for (let i = 0; i < nextBoard.length; i++) {
    const u = nextBoard[i];
    if (!u || u.id !== "parasite" || i === summonedUnitIndex) continue;
    const b = atLevel(PARASITE.buff, u.level);
    nextBoard[i] = {
      ...u,
      tempBuffAtk: u.tempBuffAtk + b.atk,
      buffHp: u.buffHp + b.hp,
    };
    modified = true;
  }
  return modified;
}

export const applySummonEffects = (
  summonedUnitIndex: number,
  currentBoard: (UnitInstance | null)[],
): (UnitInstance | null)[] => {
  const nextBoard = [...currentBoard];
  let modified = false;

  const target = nextBoard[summonedUnitIndex];
  if (!target) return currentBoard;

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

  if (applyParasiteSummonBuff(nextBoard, summonedUnitIndex)) {
    modified = true;
  }

  if (applyWailingCursechildSummonBuff(nextBoard, summonedUnitIndex)) {
    modified = true;
  }

  return modified ? nextBoard : currentBoard;
};

function applyWailingCursechildSummonBuff(
  nextBoard: (UnitInstance | null)[],
  summonedUnitIndex: number,
): boolean {
  const target = nextBoard[summonedUnitIndex];
  if (!target) return false;
  let atkGain = 0;
  let hpGain = 0;
  for (let i = 0; i < nextBoard.length; i++) {
    const u = nextBoard[i];
    if (!u || u.id !== "wailing_cursechild" || i === summonedUnitIndex) continue;
    const b = atLevel(WAILING_CURSECHILD.buff, u.level);
    atkGain += b.atk;
    hpGain += b.hp;
  }
  if (atkGain === 0 && hpGain === 0) return false;
  nextBoard[summonedUnitIndex] = {
    ...target,
    buffAtk: target.buffAtk + atkGain,
    buffHp: target.buffHp + hpGain,
  };
  return true;
}

const END_OF_TURN_HANDLERS = {
  catacomb_rat: handleCatacombRatEndOfTurn,
  altar: handleAltarEndOfTurn,
  hanged_man: handleHangedManEndOfTurn,
} satisfies Partial<Record<UnitId, EndOfTurnHandler>>;

type EndOfTurnUnitId = keyof typeof END_OF_TURN_HANDLERS;

function isEndOfTurnUnit(id: UnitId): id is EndOfTurnUnitId {
  return id in END_OF_TURN_HANDLERS;
}

export function applyEndOfTurnEffects(
  board: (UnitInstance | null)[],
  lastBattleResult: BattleResult = null,
): (UnitInstance | null)[] {
  let result = board;
  for (let i = 0; i < result.length; i++) {
    const u = result[i];
    if (!u || !isEndOfTurnUnit(u.id)) continue;
    const next = END_OF_TURN_HANDLERS[u.id](result, i, lastBattleResult);
    if (next !== null) result = next;
  }
  return result;
}

export function calcAlchemyDiscount(
  board: readonly ({ id: string; level: number } | null)[],
): number {
  let total = 0;
  for (const bu of board) {
    if (!bu || bu.id !== "machine") continue;
    total += atLevel(MACHINE.discount, bu.level);
  }
  return total;
}

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

/** bone_tree (Cat): 盤上の bone_tree がアイテム装備時の attack/hp 増分を倍加する。
 *  呼び出し側が boneTreeUses を更新すること。 */
export function applyCatItemMultiplier(
  board: readonly (UnitInstance | null)[],
  itemAtk: number,
  itemHp: number,
  currentUses: number,
): { atk: number; hp: number; nextUses: number } {
  const cats = board.filter((u): u is UnitInstance => !!u && u.id === "bone_tree");
  if (cats.length === 0) return { atk: itemAtk, hp: itemHp, nextUses: currentUses };
  const totalUses = cats.reduce((s, c) => s + atLevel(CAT.uses, c.level), 0);
  if (currentUses >= totalUses) return { atk: itemAtk, hp: itemHp, nextUses: currentUses };
  const extraPerCat = cats.reduce((s, c) => s + atLevel(CAT.multPerCat, c.level), 0);
  const multiplier = 1 + extraPerCat;
  return {
    atk: itemAtk * multiplier,
    hp: itemHp * multiplier,
    nextUses: currentUses + 1,
  };
}
