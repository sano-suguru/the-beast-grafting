import { initAudio, playSE } from "../engine/audio";
import { canUndo, shopLocked, currentRunId } from "./game-store";
import { runShopAction } from "./shop-actions";
import { undoAction as apiUndoAction } from "../api/shop-client";

export function undoLastAction(): void {
  if (!canUndo.value) return;
  if (shopLocked.value) return;
  const runId = currentRunId.value;
  if (!runId) return;

  initAudio();
  void runShopAction("[undo]", apiUndoAction(runId), () => {
    playSE("select");
  });
}
