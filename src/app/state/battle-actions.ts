import { batch } from "@preact/signals";
import type { UnitInstance } from "../types";
import type { ServerBattleResult } from "../../shared/api-types";
import { pvpOpponentToEnemyTeam } from "../../shared/board-unit";
import {
  phase,
  round,
  life,
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
import { detectTierUnlock } from "../../shared/data/tiers";
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
  battleLoadError.value = null;
  loadBattleInBackground(runId, round.value);
}

export function startActualBattle() {
  if (phase.value !== "PRE_BATTLE") return;
  if (battleLoading.value) return;
  if (battleLoadError.value !== null) return;
  if (battleFrames.value.length === 0) return;

  batch(() => {
    phase.value = "BATTLE";
    fastForward.value = false;
    currentFrameIdx.value = 0;
  });
}

function requireBattleResult(): ServerBattleResult {
  const result = battleResult.value;
  invariant(result !== null, "battleResult must be set");
  return result;
}

// markMasteredはサーバー側 /api/run/advance で処理される。ここでは呼ばず、
// 次回起動時の pendingBattle recovery による再実行に委ねる。
function applyLocalFallback(localResult: ServerBattleResult) {
  const isWin = localResult === "WIN";
  const isLose = localResult === "LOSE";

  let trophyDelta = 0;
  let lifeDelta = 0;
  let gameEnded = false;

  if (isWin) {
    trophyDelta = 1;
    if (trophy.value + 1 >= 10) {
      gameEnded = true;
    }
  } else if (isLose) {
    lifeDelta = -1;
    if (life.value - 1 <= 0) {
      gameEnded = true;
    }
  }

  const prevRound = round.value;
  batch(() => {
    trophy.value = Math.min(trophy.value + trophyDelta, 10);
    life.value = Math.max(life.value + lifeDelta, 0);
    if (!gameEnded) round.value = round.value + 1;
    const unlockedTier = gameEnded ? null : detectTierUnlock(prevRound, round.value);
    battleConcludeData.value = { lifeDelta, trophyDelta, gameEnded, unlockedTier };
    phase.value = "BATTLE_RESULT";
  });
}

async function executeConclude() {
  const currentBattleId = lastBattleId.value;

  if (!currentBattleId) {
    applyLocalFallback(requireBattleResult());
    return;
  }

  const result = await advanceRun(currentBattleId);
  result.match(
    (run) => {
      const prevLife = life.value;
      const prevTrophy = trophy.value;
      const gameEnded = run.status === "won" || run.status === "lost";
      const unlockedTier = gameEnded ? null : detectTierUnlock(round.value, run.round);
      batch(() => {
        life.value = run.life;
        trophy.value = run.trophy;
        round.value = run.round;
        battleConcludeData.value = {
          lifeDelta: run.life - prevLife,
          trophyDelta: run.trophy - prevTrophy,
          gameEnded,
          unlockedTier,
        };
        phase.value = "BATTLE_RESULT";
      });
    },
    (e) => {
      logError("[RunAdvance:localFallback]", e);
      applyLocalFallback(requireBattleResult());
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
      applyLocalFallback(requireBattleResult());
    }
    battleBusy.value = false;
  });
}

export function proceedFromBattleResult() {
  const data = battleConcludeData.value;
  if (!data) return;

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
