vi.mock("../engine/audio", () => ({
  initAudio: vi.fn(),
  playSE: vi.fn(),
}));

vi.mock("../engine/shop-effects", () => ({
  graftUnits: vi.fn((base: UnitInstance) => ({
    ...base,
    level: base.level + 1,
    exp: 1,
  })),
  applyBuyEffects: vi.fn((_unit: UnitInstance, board: (UnitInstance | null)[]) => ({
    board,
    chaliceTriggered: false,
    rotRingUses: 0,
  })),
  applyChaliceEffect: vi.fn((items: (ShopItemSlot | null)[]) => items),
  applySummonEffects: vi.fn((_idx: number, board: (UnitInstance | null)[]) => board),
  applyEndOfTurnEffects: vi.fn((board: (UnitInstance | null)[]) => board),
}));

import { checkHighlight } from "./card-actions";
import {
  blood,
  board,
  shopUnits,
  shopItems,
  selection,
  onboardingStep,
  lastBattleResult,
} from "./game-store";
import { makeUnit } from "../engine/test-helpers";
import type { ItemData, ShopItemSlot, UnitInstance } from "../types";

function makeItem(overrides: Partial<ItemData> = {}): ItemData {
  return {
    id: "iron_plate",
    name: "鉄板",
    cost: 3,
    atk: 0,
    hp: 2,
    equip: "iron",
    skillText: "",
    lore: "",
    ...overrides,
  };
}

beforeEach(() => {
  blood.value = 10;
  board.value = [null, null, null, null, null];
  shopUnits.value = [];
  shopItems.value = [];
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
