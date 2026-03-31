import { ITEMS } from "../shared/data/items";
import type { UnitInstance, ShopItemSlot } from "../shared/types";
import { ALTAR_BUFF, ROT_RING_MAX_USES, MACHINE_BUFF } from "./constants";
import { EXP_PER_LEVEL, MAX_UNIT_LEVEL } from "../shared/constants";
import { computeZealotBuff } from "./buff-utils";

export const graftUnits = (base: UnitInstance, material: UnitInstance): UnitInstance => {
  const newExp = base.exp + 1;
  const newLevel =
    newExp >= base.level * EXP_PER_LEVEL ? Math.min(MAX_UNIT_LEVEL, base.level + 1) : base.level;
  return {
    ...base,
    atk: base.atk + material.atk,
    hp: base.hp + material.hp,
    exp: newExp,
    level: newLevel,
  };
};

function applyRotRingBuff(
  boughtUnit: UnitInstance,
  board: (UnitInstance | null)[],
  rotRingUses: number,
): { board: (UnitInstance | null)[]; rotRingUses: number } {
  if (boughtUnit.tier !== 1 || rotRingUses >= ROT_RING_MAX_USES) {
    return { board, rotRingUses };
  }
  let rotRingCount = 0;
  board.forEach((u) => {
    if (u && u.id === "rot_ring") rotRingCount += 1;
  });
  if (rotRingCount === 0) return { board, rotRingUses };
  return {
    board: board.map((bu) =>
      bu
        ? {
            ...bu,
            atk: bu.atk + rotRingCount,
            hp: bu.hp + rotRingCount,
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

  let altarCount = 0;
  nextBoard.forEach((u) => {
    if (u && u.id === "altar") altarCount += 1;
  });
  if (altarCount > 0) {
    nextBoard[summonedUnitIndex] = {
      ...target,
      atk: target.atk + ALTAR_BUFF.atk * altarCount,
      hp: target.hp + ALTAR_BUFF.hp * altarCount,
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
      atk: current.atk + zealotCount,
    };
    modified = true;
  }

  return modified ? nextBoard : currentBoard;
};

export const applyEndOfTurnEffects = (
  currentBoard: (UnitInstance | null)[],
): (UnitInstance | null)[] => {
  let nextBoard = [...currentBoard];
  let modified = false;

  // SAP: Monkey相当
  const frontIdx = nextBoard.findIndex((u) => u !== null);
  if (frontIdx !== -1) {
    nextBoard.forEach((u) => {
      if (!u || u.id !== "machine") return;
      modified = true;
      const front = nextBoard[frontIdx];
      if (!front) return;
      nextBoard[frontIdx] = {
        ...front,
        atk: front.atk + MACHINE_BUFF.atk,
        hp: front.hp + MACHINE_BUFF.hp,
      };
    });
  }

  return modified ? nextBoard : currentBoard;
};
