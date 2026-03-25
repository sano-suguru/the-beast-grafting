import { batch } from "@preact/signals";
import type { UnitInstance, EnemyTeam, BattleFrame, BattleResult } from "../types";
import { initAudio, playSE } from "../engine/audio";
import { generateEnemyTeam } from "../engine/helpers";
import { runBattleAsync } from "../battle-worker/client";
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
  onboardingStep,
  undoSnapshot,
} from "./game-store";
import { markSeen, markMastered } from "./lore";
import { markTutorialDone } from "./tutorial";
import { setupNight } from "./shop-actions";
import { applyEndOfTurnEffects } from "../engine/shop-effects";
import { ok, err } from "../../shared/errors";
import type { Result, GameError } from "../../shared/errors";
import { error as logError } from "../../shared/logger";

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
  const enemy = currentEnemyTeam.value ?? generateEnemyTeam(round.value);
  const shouldFinishTutorial = onboardingStep.value === "battle";

  batch(() => {
    undoSnapshot.value = null;
    board.value = nextBoard;
    currentEnemyTeam.value = enemy;
    selection.value = null;
    phase.value = "PRE_BATTLE";
    if (shouldFinishTutorial) onboardingStep.value = null;
  });

  if (shouldFinishTutorial) markTutorialDone();
}

function validateActualBattle(enemy: EnemyTeam | null): Result<EnemyTeam, GameError> {
  if (!enemy) return err({ type: "PRECONDITION_FAILED", reason: "no_enemy" });
  return ok(enemy);
}

function applyBattleResult(frames: BattleFrame[], result: BattleResult, enemyTeamType: string) {
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

export function startActualBattle() {
  initAudio();
  playSE("select");
  validateActualBattle(currentEnemyTeam.value).match(
    (enemy) => {
      if (phase.value !== "PRE_BATTLE") return;
      executeBattle(enemy).catch((e: unknown) => {
        logError("[BattleCrash]", e);
        applyBattleResult([], "DRAW", enemy.teamType);
      });
    },
    () => playSE("error"),
  );
}

async function executeBattle(enemy: EnemyTeam) {
  const currentBoard = board.value;
  phase.value = "BATTLE_LOADING";
  const currentRound = round.value;
  const prevResult = lastBattleResult.value;
  const res = await runBattleAsync(currentBoard, enemy, currentRound, prevResult);
  res.match(
    ({ frames, result }) => applyBattleResult(frames, result, enemy.teamType),
    (e) => {
      logError("[BattleWorkerErr]", e);
      applyBattleResult([], "DRAW", enemy.teamType);
    },
  );
}

export function concludeBattle() {
  initAudio();
  playSE("select");

  const isWin = battleResult.value === "WIN";
  const isGameClear = isWin && trophy.value + 1 >= 10;

  if (isWin) {
    if (isGameClear) {
      const lvl3Ids = board.value
        .filter((u): u is UnitInstance => u !== null && u.level === 3 && !u.isChurch)
        .map((u) => u.id);
      if (lvl3Ids.length > 0) markMastered(lvl3Ids);
      batch(() => {
        trophy.value = 10;
        phase.value = "RESULT";
      });
      return;
    }
    trophy.value += 1;
  } else if (battleResult.value === "LOSE") {
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
