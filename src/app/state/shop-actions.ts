import { batch } from "@preact/signals";
import type {
  OriginId,
  ShopSlot,
  ShopItemSlot,
  UnitInstance,
  Selection,
  EventData,
} from "../types";
import { ITEMS } from "../../shared/data/items";
import { initAudio, playSE } from "../engine/audio";
import {
  createUnit,
  getShopPool,
  getItemPool,
  getUnitsByTier,
  pickRandom,
} from "../../shared/engine/helpers";
import {
  isEventRound,
  selectEvent,
  buildEventShopUnits,
  buildEventShopItems,
} from "../../shared/engine/event-helpers";
import type { Rng } from "../../shared/engine/rng";
import { createDefaultRng } from "../../shared/engine/rng";
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
  activeEvent,
  showHelpOverlay,
} from "./game-store";
import { markSeen } from "./lore";
import { invariant } from "../../shared/invariant";

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

function generateShopUnits(
  r: number,
  prev: (ShopSlot | null)[],
  sizeModifier = 0,
  rng: Rng = createDefaultRng(),
): (ShopSlot | null)[] {
  const pool = getShopPool(r);
  const size = Math.max(0, getShopSize(r) + sizeModifier);
  return [...Array(size).keys()].map((i) => {
    if (prev[i]?.frozen) return prev[i];
    return { unit: createUnit(pickRandom(pool, rng)), frozen: false };
  });
}

function applyInquisitorUpgrade(
  units: (ShopSlot | null)[],
  currentOrigin: OriginId | null,
  rng: Rng = createDefaultRng(),
): (ShopSlot | null)[] {
  if (currentOrigin !== "inquisitor") return units;
  const candidates = units
    .map((s, i) => (s && !s.frozen && s.unit.tier < 6 ? i : -1))
    .filter((i) => i >= 0);
  if (candidates.length === 0) return units;
  const targetIdx = pickRandom(candidates, rng);
  const slot = units[targetIdx];
  if (!slot) return units;
  const higherTier = getUnitsByTier(slot.unit.tier + 1);
  if (higherTier.length === 0) return units;
  const newId = pickRandom([...higherTier], rng);
  const next = [...units];
  next[targetIdx] = { unit: createUnit(newId), frozen: slot.frozen };
  return next;
}

function generateShopItems(
  r: number,
  prev: (ShopItemSlot | null)[],
  rng: Rng = createDefaultRng(),
): (ShopItemSlot | null)[] {
  const itemPool = getItemPool();
  const size = r >= 7 ? 2 : 1;
  return [...Array(size).keys()].map((i) => {
    const existing = prev[i];
    if (existing?.frozen) return existing;
    const item = ITEMS[pickRandom(itemPool, rng)];
    return { item, frozen: false };
  });
}

function buildShopForRound(
  currentRound: number,
  event: EventData | null,
  currentOrigin: OriginId | null,
  prevUnits: (ShopSlot | null)[],
  prevItems: (ShopItemSlot | null)[],
): { units: (ShopSlot | null)[]; items: (ShopItemSlot | null)[] } {
  let units: (ShopSlot | null)[];
  if (event?.replacesShopUnits) {
    units = buildEventShopUnits(event, currentRound);
  } else {
    const sizeModifier = event?.shopSizeModifier ?? 0;
    units = generateShopUnits(currentRound, prevUnits, sizeModifier);
    units = applyInquisitorUpgrade(units, currentOrigin);
  }

  if (event?.shopUnitBuff) {
    const buff = event.shopUnitBuff;
    units = units.map((slot) =>
      slot && !slot.frozen
        ? {
            ...slot,
            unit: { ...slot.unit, atk: slot.unit.atk + buff.atk, hp: slot.unit.hp + buff.hp },
          }
        : slot,
    );
  }

  const items =
    event && event.itemOffers.length > 0
      ? buildEventShopItems(event)
      : generateShopItems(currentRound, prevItems);

  return { units, items };
}

export function setupNight(
  currentRound: number,
  currentOrigin: OriginId | null = origin.value,
  useTutorialShop = false,
) {
  const event = !useTutorialShop && isEventRound(currentRound) ? selectEvent() : null;

  let nextShopUnits: (ShopSlot | null)[];
  let nextShopItems: (ShopItemSlot | null)[];

  if (useTutorialShop) {
    nextShopUnits = applyInquisitorUpgrade(
      [
        { unit: createUnit("rat"), frozen: false },
        { unit: createUnit("rat"), frozen: false },
        { unit: createUnit("bat"), frozen: false },
      ],
      currentOrigin,
    );
    nextShopItems = generateShopItems(currentRound, []);
  } else {
    const result = buildShopForRound(
      currentRound,
      event,
      currentOrigin,
      shopUnits.value,
      shopItems.value,
    );
    nextShopUnits = result.units;
    nextShopItems = result.items;
  }

  batch(() => {
    undoSnapshot.value = null;
    blood.value = 10 + (event?.bloodBonus ?? 0);
    freeRoll.value = (event?.freeRoll ?? false) || currentOrigin === "thief";
    cultistUsed.value = false;
    rotRingUses.value = 0;
    selection.value = null;
    showHelpOverlay.value = false;
    activeEvent.value = event;
    currentEnemyTeam.value = null;
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
  if (activeEvent.value?.lockRoll) {
    playSE("error");
    return;
  }
  validateRoll(freeRoll.value, blood.value).match(
    () => {
      playSE("select");
      const { units: nextShopUnits, items: nextShopItems } = buildShopForRound(
        round.value,
        activeEvent.value,
        origin.value,
        shopUnits.value,
        shopItems.value,
      );
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

export function dismissEvent() {
  invariant(activeEvent.value !== null, "dismissEvent: no active event");
  const event = activeEvent.value;
  initAudio();
  playSE("select");
  const currentRound = round.value;
  const currentOrigin = origin.value;
  const { units: nextShopUnits, items: nextShopItems } = buildShopForRound(
    currentRound,
    null,
    currentOrigin,
    [],
    [],
  );
  const bloodBeforeEvent = blood.value - event.bloodBonus;
  batch(() => {
    blood.value = Math.max(0, bloodBeforeEvent);
    activeEvent.value = null;
    freeRoll.value = currentOrigin === "thief";
    shopUnits.value = nextShopUnits;
    shopItems.value = nextShopItems;
    selection.value = null;
  });
  markShopUnitsSeen(nextShopUnits);
}

export function handleFreezeClick(isUnit: boolean, index: number) {
  initAudio();
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
