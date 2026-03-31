import { batch } from "@preact/signals";
import type { OriginId } from "../types";
import type { RunState, CurrentRunState } from "../../shared/api-types";
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
  startGameError,
  shopActionError,
  recoveryWarning,
  retiring,
  resetAllSignals,
} from "./game-store";
import { setupNight } from "./shop-actions";
import { tutorialDone } from "./tutorial";
import { ensureSession } from "../api/fetch";
import { startRun, getCurrentRun, advanceRun, retireRun } from "../api/run-client";
import { warn, error as logError } from "../../shared/logger";
import { isOriginId } from "../../shared/origin-id";

async function recoverPendingBattle(
  run: CurrentRunState,
  context: string,
): Promise<{ state: RunState; recovered: boolean }> {
  if (!run.pendingBattleId) return { state: run, recovered: true };
  warn(`[${context}] recovering pending battle`, run.pendingBattleId);
  const advanced = await advanceRun(run.pendingBattleId);
  if (advanced.isOk()) return { state: advanced.value, recovered: true };
  // 409 = battle already consumed or run already finished — 最新 state を再取得
  if (advanced.error.type === "API_FETCH_FAILED" && advanced.error.status === 409) {
    const current = await getCurrentRun();
    if (current.isOk() && current.value) {
      return { state: current.value, recovered: true };
    }
  }
  logError(`[${context}:recover]`, advanced.error);
  return { state: run, recovered: false };
}

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

async function resumeExistingRun(
  existing: CurrentRunState,
  fallbackOrigin: OriginId | null,
  context: string,
): Promise<boolean> {
  const { state: run, recovered } = await recoverPendingBattle(existing, context);
  if (!recovered) recoveryWarning.value = "前回の戦闘結果を反映できませんでした";

  const rawOriginId = run.originId ?? fallbackOrigin;
  if (!rawOriginId || !isOriginId(rawOriginId)) return false;

  applyLocalGameState(rawOriginId, run.round, run.sanity, run.trophy, run.id);
  await setupNight(run.id, false);
  return true;
}

export async function startGame(selectedOrigin: OriginId) {
  if (gameLoading.value) return;
  gameLoading.value = true;
  startGameError.value = null;
  initAudio();
  playSE("clash");

  const sessionResult = await ensureSession();
  if (sessionResult.isErr()) {
    logError("[startGame:session]", sessionResult.error);
  }

  const existing = await getCurrentRun();
  if (existing.isOk() && existing.value) {
    await resumeExistingRun(existing.value, selectedOrigin, "startGame");
    gameLoading.value = false;
    return;
  }

  const result = await startRun(selectedOrigin);
  if (result.isOk()) {
    const run = result.value;
    applyLocalGameState(selectedOrigin, run.round, run.sanity, run.trophy, run.id);
    await setupNight(run.id, !tutorialDone.value);
    gameLoading.value = false;
    return;
  }

  logError("[startGame]", result.error);
  startGameError.value = result.error;
  gameLoading.value = false;
}

export async function resumeOrSelectOrigin() {
  if (gameLoading.value) return;
  gameLoading.value = true;

  const sessionResult = await ensureSession();
  if (sessionResult.isErr()) {
    logError("[resume:session]", sessionResult.error);
  }

  const existing = await getCurrentRun();
  if (existing.isOk() && existing.value) {
    if (!(await resumeExistingRun(existing.value, null, "resume"))) {
      phase.value = "ORIGIN";
    }
    gameLoading.value = false;
    return;
  }

  if (existing.isErr()) {
    logError("[resume:getCurrentRun]", existing.error);
    startGameError.value = existing.error;
  }
  phase.value = "ORIGIN";
  gameLoading.value = false;
}

export async function retireGame() {
  if (retiring.value) return;
  retiring.value = true;
  shopActionError.value = null;
  const result = await retireRun();
  if (result.isOk()) {
    resetAllSignals();
    return;
  }
  const current = await getCurrentRun();
  if (current.isOk() && !current.value) {
    resetAllSignals();
    return;
  }
  logError("[retireGame]", result.error);
  shopActionError.value = result.error;
  retiring.value = false;
}
