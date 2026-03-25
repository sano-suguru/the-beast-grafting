import type { UnitInstance, EnemyTeam, BattleFrame, BattleResult } from "../types";
import type { BattleWorkerResponse } from "./worker";
import { simulateBattle } from "../engine/battle";
import { ok, err } from "../../shared/errors";
import type { Result, GameError } from "../../shared/errors";

function runSync(
  playerBoard: (UnitInstance | null)[],
  enemyTeam: EnemyTeam,
  round: number,
  lastBattleResult: BattleResult,
): Result<{ frames: BattleFrame[]; result: BattleResult }, GameError> {
  const data = simulateBattle(playerBoard, enemyTeam, round, lastBattleResult);
  return ok(data);
}

export function runBattleAsync(
  playerBoard: (UnitInstance | null)[],
  enemyTeam: EnemyTeam,
  round: number,
  lastBattleResult: BattleResult,
): Promise<Result<{ frames: BattleFrame[]; result: BattleResult }, GameError>> {
  if (typeof Worker === "undefined") {
    return Promise.resolve(runSync(playerBoard, enemyTeam, round, lastBattleResult));
  }

  return new Promise((resolve) => {
    const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    const timer = setTimeout(() => {
      w.terminate();
      resolve(err({ type: "PRECONDITION_FAILED", reason: "battle_timeout" }));
    }, 5000);

    w.onmessage = (e: MessageEvent<BattleWorkerResponse>) => {
      clearTimeout(timer);
      w.terminate();
      if (e.data.ok) {
        resolve(ok({ frames: e.data.frames, result: e.data.result }));
      } else {
        resolve(err({ type: "PRECONDITION_FAILED", reason: e.data.error }));
      }
    };

    w.onerror = () => {
      clearTimeout(timer);
      w.terminate();
      resolve(err({ type: "PRECONDITION_FAILED", reason: "worker_error" }));
    };

    w.postMessage({ playerBoard, enemyTeam, round, lastBattleResult });
  });
}
