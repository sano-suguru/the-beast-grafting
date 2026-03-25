import { batch } from "@preact/signals";
import type { OriginId } from "../types";
import { initAudio, playSE } from "../engine/audio";
import {
  origin,
  phase,
  blood,
  sanity,
  trophy,
  round,
  board,
  lastBattleResult,
  onboardingStep,
} from "./game-store";
import { setupNight } from "./shop-actions";
import { tutorialDone } from "./tutorial";

export function startGame(selectedOrigin: OriginId) {
  initAudio();
  playSE("clash");
  batch(() => {
    origin.value = selectedOrigin;
    phase.value = "SHOP";
    blood.value = 10;
    sanity.value = 5;
    trophy.value = 0;
    round.value = 1;
    board.value = [null, null, null, null, null];
    lastBattleResult.value = null;
    onboardingStep.value = tutorialDone.value ? null : "buy";
  });
  setupNight(1, selectedOrigin, true);
}
