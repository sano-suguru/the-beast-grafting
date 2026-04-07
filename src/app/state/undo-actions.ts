import type { SoundResult } from "../types";
import { NO_SOUND } from "../sound-results";
import { canUndo, shopLocked, currentRunId } from "./game-store";
import { runShopAction } from "./shop-actions";
import { undoAction as apiUndoAction } from "../api/shop-client";

export function undoLastAction(): SoundResult {
  if (!canUndo.value || shopLocked.value) return NO_SOUND;
  const runId = currentRunId.value;
  if (!runId) return NO_SOUND;
  return runShopAction("[undo]", apiUndoAction(runId), () => "select");
}
