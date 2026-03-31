import type { BattleFrame, EventData, ItemData } from "./types";
import type { BoardUnit, PvpOpponent } from "./board-unit";

export type ServerBattleResult = "WIN" | "LOSE" | "DRAW";

export type RunStatus = "active" | "won" | "lost" | "retired";

export interface RunState {
  id: string;
  round: number;
  sanity: number;
  trophy: number;
  status: RunStatus;
  originId: string | null;
}

export interface CurrentRunState extends RunState {
  pendingBattleId: string | null;
}

export interface BattleResponse {
  battleId: string;
  frames: BattleFrame[];
  result: ServerBattleResult;
  opponent: PvpOpponent;
  seed: number;
}

export interface ShopSlotResponse {
  unit: BoardUnit;
  frozen: boolean;
  costOverride?: number;
}

export interface ShopItemSlotResponse {
  item: ItemData;
  frozen: boolean;
}

export interface ShopStateResponse {
  blood: number;
  board: (BoardUnit | null)[];
  shopUnits: (ShopSlotResponse | null)[];
  shopItems: (ShopItemSlotResponse | null)[];
  freeRoll: boolean;
  cultistUsed: boolean;
  rotRingUses: number;
  activeEvent: EventData | null;
  canUndo: boolean;
  round: number;
  sanity: number;
  trophy: number;
}
