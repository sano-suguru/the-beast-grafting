import type { BattleFrame } from "./types";
import type { PvpOpponent } from "./board-unit";

export type ServerBattleResult = "WIN" | "LOSE" | "DRAW";

export type RunStatus = "active" | "won" | "lost";

export interface RunState {
  id: string;
  round: number;
  sanity: number;
  trophy: number;
  status: RunStatus;
  originId: string | null;
}

export interface BattleResponse {
  battleId: string;
  frames: BattleFrame[];
  result: ServerBattleResult;
  opponent: PvpOpponent;
  seed: number;
}
