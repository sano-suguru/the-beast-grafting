import type { ShopSlotJson } from "../../db/shop-state-types";
import type { BoardUnit } from "../../shared/board-unit";

export function extractLoreUnitIds(
  board: (BoardUnit | null)[],
  shopUnits: (ShopSlotJson | null)[],
  rewardSlots: (ShopSlotJson | null)[],
): string[] {
  const ids = new Set<string>();
  for (const u of board) {
    if (u) ids.add(u.id);
  }
  for (const s of shopUnits) {
    if (s) ids.add(s.unit.id);
  }
  for (const s of rewardSlots) {
    if (s) ids.add(s.unit.id);
  }
  return [...ids];
}
