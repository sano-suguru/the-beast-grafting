import { batch } from "@preact/signals";
import type { OriginId, ShopSlot, ShopItemSlot, UnitInstance, Selection } from "../types";
import { ITEMS } from "../data/items";
import { initAudio, playSE } from "../engine/audio";
import {
  createUnit,
  getShopPool,
  getItemPool,
  getUnitsByTier,
  generateEnemyTeam,
} from "../engine/helpers";
import {
  origin,
  blood,
  round,
  board,
  freeRoll,
  cultistUsed,
  sanity,
  selection,
  shopUnits,
  shopItems,
  currentEnemyTeam,
  onboardingStep,
  undoSnapshot,
  rotRingUses,
} from "./game-store";
import { markSeen } from "./lore";

function markShopUnitsSeen(slots: (ShopSlot | null)[]): void {
  markSeen(slots.filter((s): s is ShopSlot => s !== null).map((s) => s.unit.id));
}
import { ok, err } from "../../shared/errors";
import type { Result, GameError } from "../../shared/errors";
import { captureSnapshot } from "./undo-actions";

function getShopSize(r: number): number {
  if (r >= 9) return 5;
  if (r >= 5) return 4;
  return 3;
}

function generateShopUnits(r: number, prev: (ShopSlot | null)[]): (ShopSlot | null)[] {
  const pool = getShopPool(r);
  const size = getShopSize(r);
  return [...Array(size).keys()].map((i) => {
    if (prev[i]?.frozen) return prev[i];
    const id = pool[Math.floor(Math.random() * pool.length)];
    if (!id) return null;
    return { unit: createUnit(id), frozen: false };
  });
}

function applyInquisitorUpgrade(
  units: (ShopSlot | null)[],
  currentOrigin: OriginId | null,
): (ShopSlot | null)[] {
  if (currentOrigin !== "inquisitor") return units;
  // Pick a random non-frozen, non-Tier6 slot to upgrade
  const candidates = units
    .map((s, i) => (s && !s.frozen && s.unit.tier < 6 ? i : -1))
    .filter((i) => i >= 0);
  if (candidates.length === 0) return units;
  const targetIdx = candidates[Math.floor(Math.random() * candidates.length)];
  if (targetIdx === undefined) return units;
  const slot = units[targetIdx];
  if (!slot) return units;
  const higherTier = getUnitsByTier(slot.unit.tier + 1);
  if (higherTier.length === 0) return units;
  const newId = higherTier[Math.floor(Math.random() * higherTier.length)];
  if (!newId) return units;
  const next = [...units];
  next[targetIdx] = { unit: createUnit(newId), frozen: slot.frozen };
  return next;
}

function generateShopItems(r: number, prev: (ShopItemSlot | null)[]): (ShopItemSlot | null)[] {
  const itemPool = getItemPool();
  const size = r >= 7 ? 2 : 1;
  return [...Array(size).keys()].map((i) => {
    const existing = prev[i];
    if (existing?.frozen) return existing;
    const itemId = itemPool[Math.floor(Math.random() * itemPool.length)];
    if (!itemId) return null;
    const item = ITEMS[itemId];
    if (!item) return null;
    return { item, frozen: false };
  });
}

export function setupNight(
  currentRound: number,
  currentOrigin: OriginId | null = origin.value,
  isInitialSetup = false,
) {
  let nextShopUnits: (ShopSlot | null)[];
  if (isInitialSetup) {
    nextShopUnits = [
      { unit: createUnit("rat"), frozen: false },
      { unit: createUnit("rat"), frozen: false },
      { unit: createUnit("bat"), frozen: false },
    ];
  } else {
    nextShopUnits = generateShopUnits(currentRound, shopUnits.value);
  }
  nextShopUnits = applyInquisitorUpgrade(nextShopUnits, currentOrigin);

  const nextShopItems = isInitialSetup
    ? generateShopItems(currentRound, [])
    : generateShopItems(currentRound, shopItems.value);

  batch(() => {
    undoSnapshot.value = null;
    blood.value = 10;
    freeRoll.value = currentOrigin === "thief";
    cultistUsed.value = false;
    rotRingUses.value = 0;
    selection.value = null;
    currentEnemyTeam.value = generateEnemyTeam(currentRound);
    shopUnits.value = nextShopUnits;
    shopItems.value = nextShopItems;
  });

  markShopUnitsSeen(nextShopUnits);
}

function validateRoll(hasFreeRoll: boolean, currentBlood: number): Result<void, GameError> {
  if (!hasFreeRoll && currentBlood < 1)
    return err({
      type: "INSUFFICIENT_RESOURCE",
      resource: "blood",
      required: 1,
      current: currentBlood,
    });
  return ok(undefined);
}

export function rollShop() {
  initAudio();
  validateRoll(freeRoll.value, blood.value).match(
    () => {
      captureSnapshot();
      playSE("select");
      const nextShopUnits = applyInquisitorUpgrade(
        generateShopUnits(round.value, shopUnits.value),
        origin.value,
      );
      const nextShopItems = generateShopItems(round.value, shopItems.value);
      batch(() => {
        if (!freeRoll.value) blood.value -= 1;
        freeRoll.value = false;
        selection.value = null;
        if (onboardingStep.value === "roll") onboardingStep.value = "battle";
        shopUnits.value = nextShopUnits;
        shopItems.value = nextShopItems;
      });
      markShopUnitsSeen(nextShopUnits);
    },
    () => playSE("error"),
  );
}

export function handleFreezeClick(isUnit: boolean, index: number) {
  initAudio();
  captureSnapshot();
  playSE("select");
  batch(() => {
    if (isUnit) {
      const n = [...shopUnits.value];
      const slot = n[index];
      if (slot) n[index] = { ...slot, frozen: !slot.frozen };
      shopUnits.value = n;
    } else {
      const n = [...shopItems.value];
      const slot = n[index];
      if (slot) n[index] = { ...slot, frozen: !slot.frozen };
      shopItems.value = n;
    }
    selection.value = null;
  });
}

interface SellAction {
  unit: UnitInstance;
  index: number;
  bloodGain: number;
}

function validateSell(
  sel: Selection | null,
  currentBoard: (UnitInstance | null)[],
): Result<SellAction, GameError> {
  if (!sel || sel.type !== "BOARD_UNIT")
    return err({ type: "PRECONDITION_FAILED", reason: "no_board_unit_selected" });
  const unit = currentBoard[sel.index];
  if (!unit) return err({ type: "INVALID_TARGET", reason: "slot_empty" });
  return ok({ unit, index: sel.index, bloodGain: unit.id === "beggar" ? 2 : 1 });
}

export function executeSellUnit() {
  validateSell(selection.value, board.value).match(
    ({ index, bloodGain }) => {
      captureSnapshot();
      playSE("graft");
      const newBoard = [...board.value];
      newBoard[index] = null;
      if (origin.value === "surgeon") {
        const active = newBoard
          .map((u, i) => (u ? i : null))
          .filter((i): i is number => i !== null);
        if (active.length > 0) {
          const targetIdx = active[Math.floor(Math.random() * active.length)];
          if (targetIdx !== undefined) {
            const target = newBoard[targetIdx];
            if (target) {
              newBoard[targetIdx] = { ...target, atk: target.atk + 1, hp: target.hp + 1 };
            }
          }
        }
      }
      batch(() => {
        blood.value += bloodGain;
        board.value = newBoard;
        selection.value = null;
      });
    },
    () => playSE("error"),
  );
}

function validateCultist(
  currentOrigin: OriginId | null,
  isUsed: boolean,
  currentSanity: number,
): Result<void, GameError> {
  if (currentOrigin !== "cultist")
    return err({ type: "PRECONDITION_FAILED", reason: "not_cultist" });
  if (isUsed) return err({ type: "PRECONDITION_FAILED", reason: "already_used" });
  if (currentSanity < 1)
    return err({
      type: "INSUFFICIENT_RESOURCE",
      resource: "sanity",
      required: 1,
      current: currentSanity,
    });
  return ok(undefined);
}

export function useCultistAbility() {
  validateCultist(origin.value, cultistUsed.value, sanity.value).match(
    () => {
      initAudio();
      captureSnapshot();
      playSE("graft");
      batch(() => {
        sanity.value -= 1;
        blood.value += 3;
        cultistUsed.value = true;
      });
    },
    () => playSE("error"),
  );
}
