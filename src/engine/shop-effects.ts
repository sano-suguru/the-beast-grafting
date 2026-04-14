import { ITEMS } from "../shared/data/items";
import type { UnitId, UnitInstance, ShopItemSlot } from "../shared/types";
import type { Rng } from "./rng";
import { effectiveAtk, effectiveHp } from "../shared/unit-stats";
import { invariant } from "../shared/invariant";
import { CUMULATIVE_EXP, MAX_UNIT_LEVEL } from "../shared/constants";
import {
  atLevel,
  ALTAR,
  ROT_RING,
  BONE_TREE,
  GRAVE_WORM,
  MARKET_VULTURE,
  ASH_FUNGUS,
  GHOUL_INFANT,
  TAINTED_PLACENTA,
  CORPSE_BROKER,
  type Buff,
  type Scaled,
} from "../shared/skill-params";
import { getSkillText } from "../shared/skill-text";
import { computeZealotBuff } from "./buff-utils";

function getActiveIndices(board: (UnitInstance | null)[]): number[] {
  return board.map((u, i) => (u ? i : null)).filter((i): i is number => i !== null);
}

function sumBuffByUnitId(
  board: (UnitInstance | null)[],
  unitId: UnitId,
  param: Scaled<Buff>,
  multiplier = 1,
): { atk: number; hp: number } {
  let atk = 0;
  let hp = 0;
  for (const u of board) {
    if (!u || u.id !== unitId) continue;
    const b = atLevel(param, u.level);
    atk += b.atk * multiplier;
    hp += b.hp * multiplier;
  }
  return { atk, hp };
}

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

interface BuyResult {
  board: (UnitInstance | null)[];
  chaliceTriggered: boolean;
  rotRingUses: number;
  shopBuff?: Buff | undefined;
}

export const applyBuyEffects = (
  boughtUnit: UnitInstance,
  currentBoard: (UnitInstance | null)[],
  rotRingUses: number,
  rng: Rng,
): BuyResult => {
  const rotRing = applyRotRingBuff(boughtUnit, currentBoard, rotRingUses);
  const board = rotRing.board;
  applyGhoulInfantBuyBuff(board, rng);
  const shopBuff =
    boughtUnit.id === "tainted_placenta"
      ? atLevel(TAINTED_PLACENTA.shopBuff, boughtUnit.level)
      : undefined;
  return {
    board,
    chaliceTriggered: boughtUnit.id === "chalice",
    rotRingUses: rotRing.rotRingUses,
    shopBuff,
  };
};

function applyGhoulInfantBuyBuff(board: (UnitInstance | null)[], rng: Rng): void {
  for (let i = 0; i < board.length; i++) {
    const u = board[i];
    if (!u || u.id !== "ghoul_infant") continue;
    buffRandomUnit(board, atLevel(GHOUL_INFANT.atkBuff, u.level), 0, rng, i);
  }
}

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

interface SellResult {
  board: (UnitInstance | null)[];
  shopBuff?: { atk: number; hp: number } | undefined;
}

export function buffRandomUnit(
  board: (UnitInstance | null)[],
  atkBuff: number,
  hpBuff: number,
  rng: Rng,
  excludeIdx?: number,
): void {
  const active = getActiveIndices(board).filter((i) => i !== excludeIdx);
  if (active.length === 0) return;
  const idx = active[Math.floor(rng.next() * active.length)]!;
  const target = board[idx]!;
  board[idx] = { ...target, buffAtk: target.buffAtk + atkBuff, buffHp: target.buffHp + hpBuff };
}

function applyGraveWormSell(soldUnit: UnitInstance, nextBoard: (UnitInstance | null)[], rng: Rng) {
  if (soldUnit.id !== "grave_worm") return;
  const b = atLevel(GRAVE_WORM.sellBuff, soldUnit.level);
  buffRandomUnit(nextBoard, b.atk, b.hp, rng);
}

function collectMarketVultureShopBuff(
  board: (UnitInstance | null)[],
): { atk: number; hp: number } | undefined {
  const { atk, hp } = sumBuffByUnitId(board, "market_vulture", MARKET_VULTURE.shopBuff);
  return atk > 0 || hp > 0 ? { atk, hp } : undefined;
}

function applyAshFungusSell(soldUnit: UnitInstance, nextBoard: (UnitInstance | null)[], rng: Rng) {
  const totalStats = effectiveAtk(soldUnit) + effectiveHp(soldUnit);
  for (const u of nextBoard) {
    if (!u || u.id !== "ash_fungus") continue;
    const buff = Math.floor(totalStats * (atLevel(ASH_FUNGUS.percent, u.level) / 100));
    if (buff <= 0) continue;
    const half = Math.floor(buff / 2);
    buffRandomUnit(nextBoard, buff - half, half, rng);
  }
}

function applyCorpseBrokerSell(nextBoard: (UnitInstance | null)[]): void {
  for (let i = 0; i < nextBoard.length; i++) {
    const u = nextBoard[i];
    if (!u || u.id !== "corpse_broker") continue;
    const b = atLevel(CORPSE_BROKER.sellBuff, u.level);
    nextBoard[i] = { ...u, buffAtk: u.buffAtk + b.atk, buffHp: u.buffHp + b.hp };
  }
}

export const applySellEffects = (
  soldUnit: UnitInstance,
  currentBoard: (UnitInstance | null)[],
  rng: Rng,
): SellResult => {
  const nextBoard = [...currentBoard];
  applyGraveWormSell(soldUnit, nextBoard, rng);
  const shopBuff = collectMarketVultureShopBuff(nextBoard);
  applyAshFungusSell(soldUnit, nextBoard, rng);
  applyCorpseBrokerSell(nextBoard);
  return { board: nextBoard, shopBuff };
};

export const applyBoneTreeBuyEffects = (
  boughtUnit: UnitInstance,
  currentBoard: (UnitInstance | null)[],
): (UnitInstance | null)[] => {
  const { atk, hp } = sumBuffByUnitId(currentBoard, "bone_tree", BONE_TREE.buff, boughtUnit.tier);
  if (atk === 0 && hp === 0) return currentBoard;
  return currentBoard.map((u) =>
    u ? { ...u, buffAtk: u.buffAtk + atk, buffHp: u.buffHp + hp } : null,
  );
};
