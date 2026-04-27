import type { BoardUnit } from "../shared/board-unit";
import type { EventData } from "../shared/types";

export interface ShopSlotJson {
  unit: BoardUnit;
  frozen: boolean;
  costOverride?: number;
  eventSourced: boolean;
}

export interface ShopItemSlotJson {
  itemId: string;
  frozen: boolean;
}

export interface ShopUndoSnapshot {
  blood: number;
  board: (BoardUnit | null)[];
  shopUnits: (ShopSlotJson | null)[];
  shopItems: (ShopItemSlotJson | null)[];
  shopBuffAtk: number;
  shopBuffHp: number;
  freeRoll: boolean;
  cultistUsed: boolean;
  rotRingUses: number;
  boneTreeUses: number;
  corpseBrokerUses: number;
  activeEvent: EventData | null;
  rngS0: number;
  rngS1: number;
  life: number;
  rewardSlots: (ShopSlotJson | null)[];
}
