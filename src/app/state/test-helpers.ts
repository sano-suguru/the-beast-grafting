import type { ShopStateResponse } from "../../shared/api-types";
import type { UnitInstance } from "../types";
import { unitInstanceToBoardUnit } from "../../shared/board-unit";

export function makeShopState(overrides: Partial<ShopStateResponse> = {}): ShopStateResponse {
  return {
    blood: 10,
    board: [null, null, null, null, null],
    shopUnits: [],
    shopItems: [],
    freeRoll: false,
    cultistUsed: false,
    rotRingUses: 0,
    activeEvent: null,
    rewardSlots: [],
    canUndo: false,
    round: 1,
    sanity: 5,
    trophy: 0,
    ...overrides,
  };
}

export function toBoardUnit(u: UnitInstance) {
  return unitInstanceToBoardUnit(u);
}
