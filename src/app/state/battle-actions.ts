import { batch } from "@preact/signals";
import type { UnitInstance, BattleResult } from "../types";
import { initAudio, playSE } from "../engine/audio";
import { pvpOpponentToEnemyTeam } from "../../shared/board-unit";
import {
  phase,
  round,
  sanity,
  trophy,
  board,
  currentEnemyTeam,
  battleFrames,
  currentFrameIdx,
  battleResult,
  fastForward,
  lastBattleResult,
  lastEnemyTeamType,
  currentRunId,
  lastBattleId,
  battleError,
  battleBusy,
  battleLoading,
  battleLoadError,
  battleConcludeData,
  onboardingStep,
  shopLocked,
  shopActionError,
} from "./game-store";
import { markTutorialDone } from "./tutorial";
import { setupNight, applyShopState } from "./shop-actions";
import { ok, err, safeAsync, fetchErr } from "../../shared/errors";
import type { Result, GameError } from "../../shared/errors";
import { invariant } from "../../shared/invariant";
import { error as logError } from "../../shared/logger";
import { requestBattle } from "../api/pvp-client";
import { readyForBattle as apiReadyForBattle } from "../api/shop-client";
import { advanceRun } from "../api/run-client";

function validatePreBattle(currentBoard: (UnitInstance | null)[]): Result<void, GameError> {
  if (!currentBoard.some((u) => u !== null))
    return err({ type: "PRECONDITION_FAILED", reason: "empty_board" });
  return ok(undefined);
}

function loadBattleInBackground(runId: string, currentRound: number) {
  battleLoading.value = true;
  battleLoadError.value = null;

  void requestBattle(runId, currentRound)
    .then((result) => {
      batch(() => {
        battleLoading.value = false;
        result.match(
          ({ frames, result: battleRes, opponent, battleId }) => {
            currentEnemyTeam.value = pvpOpponentToEnemyTeam(opponent);
            lastBattleId.value = battleId;
            battleFrames.value = frames;
            battleResult.value = battleRes;
            lastBattleResult.value = battleRes;
            lastEnemyTeamType.value = opponent.teamType;
          },
          (error) => {
            battleLoadError.value = error;
            logError("[loadBattle]", error);
          },
        );
      });
    })
    .catch((error: unknown) => {
      batch(() => {
        battleLoading.value = false;
        battleLoadError.value = fetchErr(error);
      });
      logError("[loadBattle:crash]", error);
    });
}

export function startPreBattle() {
  if (validatePreBattle(board.value).isErr()) return;
  if (shopLocked.value) return;
  const runId = currentRunId.value;
  if (!runId) return;

  initAudio();
  playSE("clash");
  const shouldFinishTutorial = onboardingStep.value === "battle";
  const currentRound = round.value;

  shopLocked.value = true;

  void apiReadyForBattle(runId)
    .then((result) => {
      batch(() => {
        shopLocked.value = false;
        result.match(
          (shopState) => {
            applyShopState(shopState);
            phase.value = "PRE_BATTLE";
            if (shouldFinishTutorial) onboardingStep.value = null;
            if (shouldFinishTutorial) markTutorialDone();
            loadBattleInBackground(runId, currentRound);
          },
          (error) => {
            shopActionError.value = error;
            logError("[startPreBattle]", error);
          },
        );
      });
    })
    .catch((error: unknown) => {
      batch(() => {
        shopLocked.value = false;
        shopActionError.value = fetchErr(error);
      });
      logError("[startPreBattle:crash]", error);
    });
}

export function retryBattle() {
  if (battleLoading.value) return;
  const runId = currentRunId.value;
  if (!runId) return;
  loadBattleInBackground(runId, round.value);
}

export function startActualBattle() {
  if (phase.value !== "PRE_BATTLE") return;
  if (battleLoading.value) return;
  if (battleLoadError.value !== null) return;
  if (battleFrames.value.length === 0) return;

  initAudio();
  playSE("select");

  batch(() => {
    phase.value = "BATTLE";
    fastForward.value = false;
    currentFrameIdx.value = 0;
  });
}

// markMasteredはサーバー側 /api/run/advance で処理される。ここでは呼ばず、
// 次回起動時の pendingBattle recovery による再実行に委ねる。
function applyLocalFallback(localResult: BattleResult) {
  invariant(localResult !== null, "applyLocalFallback called without battle result");
  const isWin = localResult === "WIN";
  const isLose = localResult === "LOSE";

  let trophyDelta = 0;
  let sanityDelta = 0;
  let gameEnded = false;

  if (isWin) {
    trophyDelta = 1;
    if (trophy.value + 1 >= 10) {
      gameEnded = true;
    }
  } else if (isLose) {
    sanityDelta = -1;
    if (sanity.value - 1 <= 0) {
      gameEnded = true;
    }
  }

  batch(() => {
    trophy.value = Math.min(trophy.value + trophyDelta, 10);
    sanity.value = Math.max(sanity.value + sanityDelta, 0);
    if (!gameEnded) round.value = round.value + 1;
    battleConcludeData.value = { sanityDelta, trophyDelta, gameEnded };
    phase.value = "BATTLE_RESULT";
  });
}

async function executeConclude() {
  initAudio();
  playSE("select");

  const currentBattleId = lastBattleId.value;
  const localResult = battleResult.value;

  if (!currentBattleId) {
    applyLocalFallback(localResult);
    return;
  }

  const result = await advanceRun(currentBattleId);
  result.match(
    (run) => {
      const prevSanity = sanity.value;
      const prevTrophy = trophy.value;
      const gameEnded = run.status === "won" || run.status === "lost";
      batch(() => {
        sanity.value = run.sanity;
        trophy.value = run.trophy;
        round.value = run.round;
        battleConcludeData.value = {
          sanityDelta: run.sanity - prevSanity,
          trophyDelta: run.trophy - prevTrophy,
          gameEnded,
        };
        phase.value = "BATTLE_RESULT";
      });
    },
    (e) => {
      logError("[RunAdvance:localFallback]", e);
      applyLocalFallback(localResult);
    },
  );
}

export function concludeBattle() {
  if (battleBusy.value) return;
  battleBusy.value = true;

  void safeAsync(executeConclude, fetchErr).then((result) => {
    if (result.isErr()) {
      logError("[ConcludeBattleCrash]", result.error);
      battleError.value = result.error;
      applyLocalFallback(battleResult.value);
    }
    battleBusy.value = false;
  });
}

export function proceedFromBattleResult() {
  const data = battleConcludeData.value;
  if (!data) return;

  initAudio();
  playSE("select");

  if (data.gameEnded) {
    batch(() => {
      battleConcludeData.value = null;
      phase.value = "RESULT";
    });
    return;
  }

  const runId = currentRunId.value;
  batch(() => {
    battleConcludeData.value = null;
    phase.value = "SHOP";
  });
  if (runId) void setupNight(runId);
}
