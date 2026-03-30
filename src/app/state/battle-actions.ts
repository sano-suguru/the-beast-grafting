import { batch } from "@preact/signals";
import type { UnitInstance, BattleFrame, BattleResult } from "../types";
import type { EnemyFaction } from "../../shared/enemy-faction";
import { initAudio, playSE } from "../engine/audio";
import { pvpOpponentToEnemyTeam } from "../../shared/board-unit";
import {
  phase,
  round,
  sanity,
  trophy,
  board,
  selection,
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
  onboardingStep,
  undoSnapshot,
} from "./game-store";
import { markSeen, markMastered } from "./lore";
import { markTutorialDone } from "./tutorial";
import { setupNight } from "./shop-actions";
import { applyEndOfTurnEffects } from "../../shared/engine/shop-effects";
import { ok, err, safeAsync } from "../../shared/errors";
import type { Result, GameError, InfraError } from "../../shared/errors";
import { invariant } from "../../shared/invariant";
import { error as logError } from "../../shared/logger";
import { uploadSnapshot, requestBattle } from "../api/pvp-client";
import { advanceRun } from "../api/run-client";

let snapshotUpload: Promise<Result<void, InfraError>> | null = null;

export function resetBattleInternals() {
  snapshotUpload = null;
}

function validatePreBattle(currentBoard: (UnitInstance | null)[]): Result<void, GameError> {
  if (!currentBoard.some((u) => u !== null))
    return err({ type: "PRECONDITION_FAILED", reason: "empty_board" });
  return ok(undefined);
}

export function startPreBattle() {
  if (validatePreBattle(board.value).isErr()) return;
  initAudio();
  playSE("clash");
  markSeen(board.value.filter((u): u is UnitInstance => u !== null).map((u) => u.id));

  // Apply end-of-turn effects (SAP: Monkey) before battle
  const nextBoard = applyEndOfTurnEffects(board.value);
  const shouldFinishTutorial = onboardingStep.value === "battle";

  batch(() => {
    undoSnapshot.value = null;
    board.value = nextBoard;
    selection.value = null;
    phase.value = "PRE_BATTLE";
    if (shouldFinishTutorial) onboardingStep.value = null;
  });

  if (shouldFinishTutorial) markTutorialDone();

  const units = nextBoard.filter((u): u is UnitInstance => u !== null);
  const runId = currentRunId.value;
  if (units.length > 0 && runId) {
    snapshotUpload = uploadSnapshot(runId, round.value, units);
  }
}

function applyBattleResult(
  frames: BattleFrame[],
  result: BattleResult,
  enemyTeamType: EnemyFaction,
) {
  batch(() => {
    phase.value = "BATTLE";
    fastForward.value = false;
    battleFrames.value = frames;
    currentFrameIdx.value = 0;
    battleResult.value = result;
    lastBattleResult.value = result;
    lastEnemyTeamType.value = enemyTeamType;
  });
}

const crashErr = (e: unknown): InfraError => ({ type: "API_FETCH_FAILED", status: 0, cause: e });

export function startActualBattle() {
  if (battleBusy.value) return;
  if (phase.value !== "PRE_BATTLE") return;

  initAudio();
  playSE("select");

  battleBusy.value = true;
  phase.value = "BATTLE_LOADING";

  void safeAsync(executeBattle, crashErr).then((result) => {
    if (result.isErr()) {
      logError("[BattleCrash]", result.error);
      battleError.value = result.error;
    }
    battleBusy.value = false;
  });
}

async function executeBattle() {
  battleError.value = null;

  if (snapshotUpload) {
    const uploadResult = await snapshotUpload;
    snapshotUpload = null;
    if (uploadResult.isErr()) {
      logError("[SnapshotUpload]", uploadResult.error);
    }
  }

  const runId = currentRunId.value;
  if (!runId) {
    battleError.value = { type: "API_FETCH_FAILED", status: 0, cause: "no active run" };
    return;
  }

  const serverResult = await requestBattle(runId, round.value);
  if (serverResult.isErr()) {
    battleError.value = serverResult.error;
    return;
  }

  const { frames, result, opponent, battleId } = serverResult.value;
  lastBattleId.value = battleId;
  currentEnemyTeam.value = pvpOpponentToEnemyTeam(opponent);
  applyBattleResult(frames, result, opponent.teamType);
}

export function retryBattle() {
  if (battleBusy.value) return;
  if (phase.value !== "BATTLE_LOADING") return;

  battleBusy.value = true;

  void safeAsync(executeBattle, crashErr).then((result) => {
    if (result.isErr()) {
      logError("[BattleRetryCrash]", result.error);
      battleError.value = result.error;
    }
    battleBusy.value = false;
  });
}

export function abandonBattle() {
  batch(() => {
    battleBusy.value = false;
    battleError.value = null;
    phase.value = "SHOP";
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
  batch(() => {
    round.value = nextRound;
    phase.value = "SHOP";
  });
  setupNight(nextRound);
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
      batch(() => {
        sanity.value = run.sanity;
        trophy.value = run.trophy;
        round.value = run.round;
        if (run.status === "won" || run.status === "lost") {
          phase.value = "RESULT";
        } else {
          phase.value = "SHOP";
          setupNight(run.round);
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

  void safeAsync(executeConclude, crashErr).then((result) => {
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
