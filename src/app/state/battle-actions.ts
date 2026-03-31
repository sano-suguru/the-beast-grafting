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
  onboardingStep,
  shopLocked,
  shopActionError,
} from "./game-store";
import { markSeen, markMastered } from "./lore";
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
            const churchIds = opponent.units.filter((u) => u.isChurch).map((u) => u.id);
            if (churchIds.length > 0) markSeen(churchIds);
          },
          (e) => {
            battleLoadError.value = e;
            logError("[loadBattle]", e);
          },
        );
      });
    })
    .catch((e: unknown) => {
      batch(() => {
        battleLoading.value = false;
        battleLoadError.value = fetchErr(e);
      });
      logError("[loadBattle:crash]", e);
    });
}

export function startPreBattle() {
  if (validatePreBattle(board.value).isErr()) return;
  if (shopLocked.value) return;
  const runId = currentRunId.value;
  if (!runId) return;

  initAudio();
  playSE("clash");
  markSeen(board.value.filter((u): u is UnitInstance => u !== null).map((u) => u.id));

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
          (e) => {
            shopActionError.value = e;
            logError("[startPreBattle]", e);
          },
        );
      });
    })
    .catch((e: unknown) => {
      batch(() => {
        shopLocked.value = false;
        shopActionError.value = fetchErr(e);
      });
      logError("[startPreBattle:crash]", e);
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

function masterBoardUnits() {
  const lvl3Ids = board.value
    .filter((u): u is UnitInstance => u !== null && u.level === 3 && !u.isChurch)
    .map((u) => u.id);
  if (lvl3Ids.length > 0) markMastered(lvl3Ids);
}

function applyLocalFallback(localResult: BattleResult) {
  invariant(localResult !== null, "applyLocalFallback called without battle result");
  const isWin = localResult === "WIN";
  const isLose = localResult === "LOSE";

  if (isWin) {
    if (trophy.value + 1 >= 10) {
      masterBoardUnits();
      batch(() => {
        trophy.value = 10;
        phase.value = "RESULT";
      });
      return;
    }
    trophy.value += 1;
  } else if (isLose) {
    if (sanity.value - 1 <= 0) {
      batch(() => {
        sanity.value = 0;
        phase.value = "RESULT";
      });
      return;
    }
    sanity.value -= 1;
  }

  const nextRound = round.value + 1;
  const runId = currentRunId.value;
  batch(() => {
    round.value = nextRound;
    phase.value = "SHOP";
  });
  if (runId) void setupNight(runId);
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
      if (run.status === "won") masterBoardUnits();
      const runId = currentRunId.value;
      batch(() => {
        sanity.value = run.sanity;
        trophy.value = run.trophy;
        round.value = run.round;
        if (run.status === "won" || run.status === "lost") {
          phase.value = "RESULT";
        } else {
          phase.value = "SHOP";
          if (runId) void setupNight(runId);
        }
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
      batch(() => {
        battleError.value = result.error;
        phase.value = "SHOP";
      });
    }
    battleBusy.value = false;
  });
}
