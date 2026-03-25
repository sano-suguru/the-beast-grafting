import { simulateBattle } from "../engine/battle";
import type { UnitInstance, EnemyTeam, BattleFrame, BattleResult } from "../types";
import { fromThrowable } from "../../shared/errors";

export interface BattleWorkerRequest {
  playerBoard: (UnitInstance | null)[];
  enemyTeam: EnemyTeam;
  round: number;
  lastBattleResult: BattleResult;
}

export type BattleWorkerResponse =
  | { ok: true; frames: BattleFrame[]; result: BattleResult }
  | { ok: false; error: string };

const safeSimulate = fromThrowable(
  (req: BattleWorkerRequest) =>
    simulateBattle(req.playerBoard, req.enemyTeam, req.round, req.lastBattleResult),
  (e): string => (e instanceof Error ? e.message : "unknown_error"),
);

self.onmessage = (e: MessageEvent<BattleWorkerRequest>) => {
  safeSimulate(e.data).match(
    ({ frames, result }) => {
      const response: BattleWorkerResponse = { ok: true, frames, result };
      self.postMessage(response);
    },
    (error) => {
      const response: BattleWorkerResponse = { ok: false, error };
      self.postMessage(response);
    },
  );
};
