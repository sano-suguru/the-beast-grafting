import { checkHighlight } from "./card-actions";
import {
  blood,
  board,
  shopUnits,
  shopItems,
  shopRewards,
  selection,
  onboardingStep,
  lastBattleResult,
  passiveGraftIds,
} from "./game-store";
import { makeUnit } from "../../engine/test-helpers";
import type { ItemData } from "../types";
import { ITEMS } from "../../shared/data/items";

function makeItem(overrides: Partial<ItemData> = {}): ItemData {
  return {
    ...ITEMS["iron_plate"],
    ...overrides,
  };
}

beforeEach(() => {
  blood.value = 10;
  board.value = [null, null, null, null, null];
  shopUnits.value = [];
  shopItems.value = [];
  shopRewards.value = [];
  selection.value = null;
  onboardingStep.value = null;
  lastBattleResult.value = null;
  vi.clearAllMocks();
});

describe("checkHighlight – basics", () => {
  it("returns false for non-BOARD_SLOT target", () => {
    selection.value = { type: "SHOP_UNIT", index: 0, item: makeUnit() };
    expect(checkHighlight("SHOP_UNIT", 0, null)).toBe(false);
  });

  it("returns false when no selection", () => {
    expect(checkHighlight("BOARD_SLOT", 0, null)).toBe(false);
  });
});

describe("checkHighlight – SHOP_ITEM selected", () => {
  it("returns 'graft' with enough blood and unit present", () => {
    blood.value = 5;
    selection.value = { type: "SHOP_ITEM", index: 0, item: makeItem({ cost: 3 }) };
    expect(checkHighlight("BOARD_SLOT", 0, makeUnit())).toBe("graft");
  });

  it("returns false with insufficient blood", () => {
    blood.value = 1;
    selection.value = { type: "SHOP_ITEM", index: 0, item: makeItem({ cost: 3 }) };
    expect(checkHighlight("BOARD_SLOT", 0, makeUnit())).toBe(false);
  });

  it("returns false when slot is empty", () => {
    blood.value = 10;
    selection.value = { type: "SHOP_ITEM", index: 0, item: makeItem() };
    expect(checkHighlight("BOARD_SLOT", 0, null)).toBe(false);
  });

  it("returns 'graft' for targetless items on empty slots", () => {
    blood.value = 10;
    selection.value = {
      type: "SHOP_ITEM",
      index: 0,
      item: makeItem({ ...ITEMS["canned_food"] }),
    };
    expect(checkHighlight("BOARD_SLOT", 0, null)).toBe("graft");
  });
});

describe("checkHighlight – SHOP_UNIT selected", () => {
  it("returns 'move' for empty slot with enough blood", () => {
    blood.value = 10;
    selection.value = { type: "SHOP_UNIT", index: 0, item: makeUnit() };
    expect(checkHighlight("BOARD_SLOT", 0, null)).toBe("move");
  });

  it("returns 'graft' for same ID unit with level < 3", () => {
    blood.value = 10;
    selection.value = { type: "SHOP_UNIT", index: 0, item: makeUnit({ id: "hound" }) };
    expect(checkHighlight("BOARD_SLOT", 0, makeUnit({ id: "hound", level: 2 }))).toBe("graft");
  });

  it("returns false for different ID unit", () => {
    blood.value = 10;
    selection.value = { type: "SHOP_UNIT", index: 0, item: makeUnit({ id: "hound" }) };
    expect(checkHighlight("BOARD_SLOT", 0, makeUnit({ id: "bat" }))).toBe(false);
  });

  it("returns false for same ID unit at level 3", () => {
    blood.value = 10;
    selection.value = { type: "SHOP_UNIT", index: 0, item: makeUnit({ id: "hound" }) };
    expect(checkHighlight("BOARD_SLOT", 0, makeUnit({ id: "hound", level: 3 }))).toBe(false);
  });

  it("returns false with insufficient blood", () => {
    blood.value = 2;
    selection.value = { type: "SHOP_UNIT", index: 0, item: makeUnit() };
    expect(checkHighlight("BOARD_SLOT", 0, null)).toBe(false);
  });
});

describe("checkHighlight – BOARD_UNIT selected", () => {
  it("returns 'move' for different index empty slot", () => {
    selection.value = { type: "BOARD_UNIT", index: 0, item: makeUnit() };
    expect(checkHighlight("BOARD_SLOT", 2, null)).toBe("move");
  });

  it("returns false for same index", () => {
    selection.value = { type: "BOARD_UNIT", index: 0, item: makeUnit() };
    expect(checkHighlight("BOARD_SLOT", 0, null)).toBe(false);
  });

  it("returns 'graft' for same ID unit at different index", () => {
    selection.value = { type: "BOARD_UNIT", index: 0, item: makeUnit({ id: "hound" }) };
    expect(checkHighlight("BOARD_SLOT", 2, makeUnit({ id: "hound", level: 1 }))).toBe("graft");
  });

  it("returns 'swap' for same ID unit at level 3", () => {
    selection.value = { type: "BOARD_UNIT", index: 0, item: makeUnit({ id: "hound" }) };
    expect(checkHighlight("BOARD_SLOT", 2, makeUnit({ id: "hound", level: 3 }))).toBe("swap");
  });

  it("returns 'swap' for different ID unit at different index", () => {
    selection.value = { type: "BOARD_UNIT", index: 0, item: makeUnit({ id: "hound" }) };
    expect(checkHighlight("BOARD_SLOT", 2, makeUnit({ id: "bat" }))).toBe("swap");
  });
});

describe("passiveGraftIds", () => {
  it("returns empty set when selection is active", () => {
    board.value = [makeUnit({ id: "hound", level: 1 }), null, null, null, null];
    shopUnits.value = [{ unit: makeUnit({ id: "hound" }), frozen: false, eventSourced: false }];
    selection.value = { type: "SHOP_UNIT", index: 0, item: makeUnit({ id: "hound" }) };
    expect(passiveGraftIds.value.size).toBe(0);
  });

  it("returns empty set when board is empty", () => {
    board.value = [null, null, null, null, null];
    shopUnits.value = [{ unit: makeUnit({ id: "hound" }), frozen: false, eventSourced: false }];
    expect(passiveGraftIds.value.size).toBe(0);
  });

  it("returns matching shop unit IDs when board has matching unit with level < 3", () => {
    board.value = [makeUnit({ id: "hound", level: 1 }), null, null, null, null];
    shopUnits.value = [{ unit: makeUnit({ id: "hound" }), frozen: false, eventSourced: false }];
    expect(passiveGraftIds.value.has("hound")).toBe(true);
  });

  it("includes matching reward unit IDs", () => {
    board.value = [makeUnit({ id: "bat", level: 2 }), null, null, null, null];
    shopRewards.value = [{ unit: makeUnit({ id: "bat" }), frozen: false, eventSourced: false }];
    expect(passiveGraftIds.value.has("bat")).toBe(true);
  });

  it("excludes level 3 units from board matching", () => {
    board.value = [makeUnit({ id: "hound", level: 3 }), null, null, null, null];
    shopUnits.value = [{ unit: makeUnit({ id: "hound" }), frozen: false, eventSourced: false }];
    expect(passiveGraftIds.value.size).toBe(0);
  });
});

describe("checkHighlight – passive-graft", () => {
  it("returns passive-graft when unit is in passiveGraftIds and no selection", () => {
    board.value = [makeUnit({ id: "hound", level: 1 }), null, null, null, null];
    shopUnits.value = [{ unit: makeUnit({ id: "hound" }), frozen: false, eventSourced: false }];
    expect(checkHighlight("SHOP_UNIT", 0, makeUnit({ id: "hound" }))).toBe("passive-graft");
  });

  it("does not return passive-graft when selection is active", () => {
    board.value = [makeUnit({ id: "hound", level: 1 }), null, null, null, null];
    shopUnits.value = [{ unit: makeUnit({ id: "hound" }), frozen: false, eventSourced: false }];
    selection.value = { type: "BOARD_UNIT", index: 0, item: makeUnit({ id: "hound" }) };
    expect(checkHighlight("SHOP_UNIT", 0, makeUnit({ id: "hound" }))).toBe(false);
  });
});
