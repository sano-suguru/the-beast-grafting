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
  lastBattleId,
  battleError,
  currentRunId,
  onboardingStep,
  showHelpOverlay,
  gameLoading,
} from "./game-store";
import { setupNight } from "./shop-actions";
import { tutorialDone } from "./tutorial";
import { ensureSession } from "../api/fetch";
import { startRun, getCurrentRun } from "../api/run-client";
import { error as logError } from "../../shared/logger";
import { isOriginId } from "../../shared/origin-id";

function applyLocalGameState(
  selectedOrigin: OriginId,
  r: number,
  s: number,
  t: number,
  runId: string | null,
) {
  batch(() => {
    origin.value = selectedOrigin;
    phase.value = "SHOP";
    blood.value = 10;
    sanity.value = s;
    trophy.value = t;
    round.value = r;
    board.value = [null, null, null, null, null];
    lastBattleResult.value = null;
    lastBattleId.value = null;
    battleError.value = null;
    currentRunId.value = runId;
    showHelpOverlay.value = false;
    onboardingStep.value = tutorialDone.value ? null : "buy";
  });
}

export async function startGame(selectedOrigin: OriginId) {
  if (gameLoading.value) return;
  gameLoading.value = true;
  initAudio();
  playSE("clash");

  const sessionResult = await ensureSession();
  if (sessionResult.isErr()) {
    logError("[startGame:session]", sessionResult.error);
  }

  const result = await startRun(selectedOrigin);
  if (result.isOk()) {
    const run = result.value;
    applyLocalGameState(selectedOrigin, run.round, run.sanity, run.trophy, run.id);
    setupNight(run.round, selectedOrigin, !tutorialDone.value);
    gameLoading.value = false;
    return;
  }

  if (result.error.type === "API_FETCH_FAILED" && result.error.status === 409) {
    const existing = await getCurrentRun();
    if (existing.isOk() && existing.value) {
      const run = existing.value;
      const rawOriginId = run.originId ?? selectedOrigin;
      const originId: OriginId = isOriginId(rawOriginId) ? rawOriginId : selectedOrigin;
      applyLocalGameState(originId, run.round, run.sanity, run.trophy, run.id);
      setupNight(run.round, originId, false);
      gameLoading.value = false;
      return;
    }
  }

  logError("[startGame]", result.error);
  applyLocalGameState(selectedOrigin, 1, 5, 0, null);
  setupNight(1, selectedOrigin, !tutorialDone.value);
  gameLoading.value = false;
}
