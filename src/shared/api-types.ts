import type { BattleFrame, EventData, ShopItemSlot } from "./types";
import type { BoardUnit, PvpOpponent } from "./board-unit";

export type ServerBattleResult = "WIN" | "LOSE" | "DRAW";

export type RunStatus = "active" | "won" | "lost" | "retired";

export interface RunState {
  id: string;
  night: number;
  life: number;
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
  eventSourced: boolean;
}

export type ShopItemSlotResponse = ShopItemSlot;

export type LoreResponse = Record<string, { mastered: boolean }>;

export interface ShopStateResponse {
  blood: number;
  board: (BoardUnit | null)[];
  shopUnits: (ShopSlotResponse | null)[];
  shopItems: (ShopItemSlotResponse | null)[];
  freeRoll: boolean;
  cultistUsed: boolean;
  rotRingUses: number;
  boneTreeUses: number;
  activeEvent: EventData | null;
  rewardSlots: (ShopSlotResponse | null)[];
  canUndo: boolean;
  night: number;
  life: number;
  trophy: number;
}
