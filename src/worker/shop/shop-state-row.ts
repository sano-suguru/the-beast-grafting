import type { ShopUndoSnapshot } from "../../db/shop-state-types";

export type ShopStateRow = ShopUndoSnapshot & {
  undoSnapshot: ShopUndoSnapshot | null;
  round: number;
};

type ShopStateNonUndoFields = "undoSnapshot" | "round";
type _AssertUndoCoverage =
  Exclude<keyof ShopStateRow, keyof ShopUndoSnapshot | ShopStateNonUndoFields> extends never
    ? true
    : "ShopStateRow has fields not in ShopUndoSnapshot or ShopStateNonUndoFields";
const _undoCoverageCheck: _AssertUndoCoverage = true;
void _undoCoverageCheck;
