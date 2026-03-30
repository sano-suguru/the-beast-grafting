import type { BoardUnit } from "../shared/board-unit";
import type { EventData } from "../shared/types";

export interface ShopSlotJson {
  unit: BoardUnit;
  frozen: boolean;
  costOverride?: number;
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
  freeRoll: boolean;
  cultistUsed: boolean;
  rotRingUses: number;
  activeEvent: EventData | null;
  rngS0: number;
  rngS1: number;
  sanity: number;
}
