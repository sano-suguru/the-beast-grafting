import { batch } from "@preact/signals";
import type { UnitInstance } from "../types";
import { initAudio, playSE } from "../engine/audio";
import {
  blood,
  sanity,
  trophy,
  board,
  shopUnits,
  shopItems,
  freeRoll,
  cultistUsed,
  onboardingStep,
  rotRingUses,
  selection,
  undoSnapshot,
} from "./game-store";

/** UnitInstance fields are all primitives — shallow copy is safe.
 *  If nested objects are added, switch to structuredClone. */
function cloneUnit(u: UnitInstance | null): UnitInstance | null {
  return u ? { ...u } : null;
}

export function captureSnapshot(): void {
  undoSnapshot.value = {
    blood: blood.value,
    sanity: sanity.value,
    trophy: trophy.value,
    board: board.value.map(cloneUnit),
    shopUnits: shopUnits.value.map((s) => (s ? { ...s, unit: { ...s.unit } } : null)),
    shopItems: shopItems.value.map((s) => (s ? { ...s, item: { ...s.item } } : null)),
    freeRoll: freeRoll.value,
    cultistUsed: cultistUsed.value,
    onboardingStep: onboardingStep.value,
    rotRingUses: rotRingUses.value,
  };
}

export function undoLastAction(): void {
  const snap = undoSnapshot.value;
  if (!snap) return;

  initAudio();
  playSE("select");
  batch(() => {
    blood.value = snap.blood;
    sanity.value = snap.sanity;
    trophy.value = snap.trophy;
    board.value = snap.board;
    shopUnits.value = snap.shopUnits;
    shopItems.value = snap.shopItems;
    freeRoll.value = snap.freeRoll;
    cultistUsed.value = snap.cultistUsed;
    onboardingStep.value = snap.onboardingStep;
    rotRingUses.value = snap.rotRingUses;
    selection.value = null;
    undoSnapshot.value = null;
  });
}
