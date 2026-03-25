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

import { handleCardClick } from "./card-actions";
import { playSE } from "../engine/audio";
import {
  graftUnits,
  applyBuyEffects,
  applyChaliceEffect,
  applySummonEffects,
} from "../engine/shop-effects";
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
import type { ItemData, ShopSlot, ShopItemSlot, UnitInstance } from "../types";

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

function makeShopSlot(overrides: Partial<ReturnType<typeof makeUnit>> = {}): ShopSlot {
  return { unit: makeUnit(overrides), frozen: false };
}

function makeShopItemSlot(overrides: Partial<ItemData> = {}): ShopItemSlot {
  return { item: makeItem(overrides), frozen: false };
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

  vi.mocked(graftUnits).mockImplementation((base: UnitInstance) => ({
    ...base,
    level: base.level + 1,
    exp: 1,
  }));
  vi.mocked(applyBuyEffects).mockImplementation(
    (_unit: UnitInstance, b: (UnitInstance | null)[]) => ({
      board: b,
      chaliceTriggered: false,
      rotRingUses: 0,
    }),
  );
  vi.mocked(applyChaliceEffect).mockImplementation((items: (ShopItemSlot | null)[]) => items);
  vi.mocked(applySummonEffects).mockImplementation((_idx: number, b: (UnitInstance | null)[]) => b);
});

describe("handleCardClick – selection / deselection", () => {
  it("deselects when clicking the same shop unit", () => {
    const unit = makeUnit();
    selection.value = { type: "SHOP_UNIT", index: 0, item: unit };
    handleCardClick("SHOP_UNIT", 0, unit);
    expect(selection.value).toBeNull();
    expect(playSE).toHaveBeenCalledWith("select");
  });

  it("deselects when clicking the same shop item", () => {
    const item = makeItem();
    selection.value = { type: "SHOP_ITEM", index: 1, item };
    handleCardClick("SHOP_ITEM", 1, item);
    expect(selection.value).toBeNull();
  });

  it("deselects when clicking the same board unit", () => {
    const unit = makeUnit();
    selection.value = { type: "BOARD_UNIT", index: 2, item: unit };
    handleCardClick("BOARD_UNIT", 2, unit);
    expect(selection.value).toBeNull();
  });

  it("selects a shop unit", () => {
    const unit = makeUnit();
    handleCardClick("SHOP_UNIT", 1, unit);
    expect(selection.value).toEqual({ type: "SHOP_UNIT", index: 1, item: unit });
    expect(playSE).toHaveBeenCalledWith("select");
  });

  it("selects a shop item", () => {
    const item = makeItem();
    handleCardClick("SHOP_ITEM", 0, item);
    expect(selection.value).toEqual({ type: "SHOP_ITEM", index: 0, item });
    expect(playSE).toHaveBeenCalledWith("select");
  });

  it("selects a board unit from occupied slot", () => {
    const unit = makeUnit();
    board.value = [unit, null, null, null, null];
    handleCardClick("BOARD_SLOT", 0, null);
    expect(selection.value).toEqual({ type: "BOARD_UNIT", index: 0, item: unit });
    expect(playSE).toHaveBeenCalledWith("select");
  });

  it("does nothing when clicking empty board slot with no selection", () => {
    handleCardClick("BOARD_SLOT", 3, null);
    expect(selection.value).toBeNull();
  });

  it("does not select when item is null for SHOP_UNIT", () => {
    handleCardClick("SHOP_UNIT", 0, null);
    expect(selection.value).toBeNull();
  });
});

describe("handleCardClick – buy unit to empty slot", () => {
  it("places unit on board and deducts blood", () => {
    const unit = makeUnit({ id: "hound" });
    shopUnits.value = [makeShopSlot({ id: "hound" }), null];
    selection.value = { type: "SHOP_UNIT", index: 0, item: unit };

    handleCardClick("BOARD_SLOT", 0, null);

    expect(blood.value).toBe(7);
    expect(board.value[0]).toBe(unit);
    expect(shopUnits.value[0]).toBeNull();
    expect(selection.value).toBeNull();
    expect(applySummonEffects).toHaveBeenCalled();
    expect(applyBuyEffects).toHaveBeenCalled();
    expect(playSE).toHaveBeenCalledWith("buy");
  });

  it("plays error and does nothing when blood < 3", () => {
    blood.value = 2;
    const unit = makeUnit();
    selection.value = { type: "SHOP_UNIT", index: 0, item: unit };

    handleCardClick("BOARD_SLOT", 0, null);

    expect(blood.value).toBe(2);
    expect(board.value[0]).toBeNull();
    expect(playSE).toHaveBeenCalledWith("error");
  });
});

describe("handleCardClick – graft shop unit onto board unit", () => {
  it("grafts when same ID and level < 3", () => {
    const shopUnit = makeUnit({ id: "hound", uid: "shop-1" });
    const boardUnit = makeUnit({ id: "hound", level: 1, uid: "board-1" });
    board.value = [boardUnit, null, null, null, null];
    shopUnits.value = [makeShopSlot({ id: "hound" })];
    selection.value = { type: "SHOP_UNIT", index: 0, item: shopUnit };

    handleCardClick("BOARD_SLOT", 0, null);

    expect(blood.value).toBe(7);
    expect(graftUnits).toHaveBeenCalledWith(boardUnit, shopUnit);
    expect(playSE).toHaveBeenCalledWith("graft");
    expect(selection.value).toBeNull();
  });

  it("plays error when IDs differ", () => {
    const shopUnit = makeUnit({ id: "bat" });
    const boardUnit = makeUnit({ id: "hound" });
    board.value = [boardUnit, null, null, null, null];
    selection.value = { type: "SHOP_UNIT", index: 0, item: shopUnit };

    handleCardClick("BOARD_SLOT", 0, null);

    expect(blood.value).toBe(10);
    expect(graftUnits).not.toHaveBeenCalled();
    expect(playSE).toHaveBeenCalledWith("error");
  });

  it("plays error when target is level 3", () => {
    const shopUnit = makeUnit({ id: "hound" });
    const boardUnit = makeUnit({ id: "hound", level: 3 });
    board.value = [boardUnit, null, null, null, null];
    selection.value = { type: "SHOP_UNIT", index: 0, item: shopUnit };

    handleCardClick("BOARD_SLOT", 0, null);

    expect(blood.value).toBe(10);
    expect(graftUnits).not.toHaveBeenCalled();
    expect(playSE).toHaveBeenCalledWith("error");
  });
});

describe("handleCardClick – equip item onto board unit", () => {
  it("applies item stats and equip to unit", () => {
    const item = makeItem({ cost: 2, atk: 1, hp: 3, equip: "iron" });
    const unit = makeUnit({ atk: 5, hp: 5, equip: null });
    board.value = [unit, null, null, null, null];
    shopItems.value = [makeShopItemSlot({ cost: 2, atk: 1, hp: 3, equip: "iron" })];
    selection.value = { type: "SHOP_ITEM", index: 0, item };

    handleCardClick("BOARD_SLOT", 0, null);

    expect(blood.value).toBe(8);
    expect(board.value[0]!.atk).toBe(6);
    expect(board.value[0]!.hp).toBe(8);
    expect(board.value[0]!.equip).toBe("iron");
    expect(shopItems.value[0]).toBeNull();
    expect(selection.value).toBeNull();
    expect(playSE).toHaveBeenCalledWith("graft");
  });

  it("plays error when target slot is empty", () => {
    const item = makeItem();
    selection.value = { type: "SHOP_ITEM", index: 0, item };

    handleCardClick("BOARD_SLOT", 0, null);

    expect(blood.value).toBe(10);
    expect(playSE).toHaveBeenCalledWith("error");
  });

  it("plays error when blood is insufficient", () => {
    blood.value = 1;
    const item = makeItem({ cost: 3 });
    const unit = makeUnit();
    board.value = [unit, null, null, null, null];
    selection.value = { type: "SHOP_ITEM", index: 0, item };

    handleCardClick("BOARD_SLOT", 0, null);

    expect(blood.value).toBe(1);
    expect(playSE).toHaveBeenCalledWith("error");
  });

  it("preservative (equip: null) preserves unit's existing equip", () => {
    const item = makeItem({ id: "preservative", cost: 3, atk: 1, hp: 1, equip: null });
    const unit = makeUnit({ atk: 5, hp: 5, equip: "iron" });
    board.value = [unit, null, null, null, null];
    shopItems.value = [
      makeShopItemSlot({ id: "preservative", cost: 3, atk: 1, hp: 1, equip: null }),
    ];
    selection.value = { type: "SHOP_ITEM", index: 0, item };

    handleCardClick("BOARD_SLOT", 0, null);

    expect(board.value[0]!.equip).toBe("iron"); // preserved
    expect(board.value[0]!.atk).toBe(6);
    expect(board.value[0]!.hp).toBe(6);
  });

  it("equip item overwrites existing equip", () => {
    const item = makeItem({ cost: 3, equip: "maggot_nest" });
    const unit = makeUnit({ atk: 5, hp: 5, equip: "iron" });
    board.value = [unit, null, null, null, null];
    shopItems.value = [makeShopItemSlot({ cost: 3, equip: "maggot_nest" })];
    selection.value = { type: "SHOP_ITEM", index: 0, item };

    handleCardClick("BOARD_SLOT", 0, null);

    expect(board.value[0]!.equip).toBe("maggot_nest");
  });

  it("pure_blood (cost 0) works with blood=0", () => {
    blood.value = 0;
    const item = makeItem({ id: "pure_blood", cost: 0, atk: 1, hp: 2, equip: null });
    const unit = makeUnit({ atk: 3, hp: 3 });
    board.value = [unit, null, null, null, null];
    shopItems.value = [makeShopItemSlot({ id: "pure_blood", cost: 0, atk: 1, hp: 2, equip: null })];
    selection.value = { type: "SHOP_ITEM", index: 0, item };

    handleCardClick("BOARD_SLOT", 0, null);

    expect(blood.value).toBe(0); // no deduction
    expect(board.value[0]!.atk).toBe(4);
    expect(board.value[0]!.hp).toBe(5);
    expect(playSE).toHaveBeenCalledWith("graft");
  });

  it("deducts correct cost for each item", () => {
    blood.value = 10;
    const item = makeItem({ cost: 2, atk: 0, hp: 0, equip: "berserk" });
    const unit = makeUnit();
    board.value = [unit, null, null, null, null];
    shopItems.value = [makeShopItemSlot({ cost: 2, equip: "berserk" })];
    selection.value = { type: "SHOP_ITEM", index: 0, item };

    handleCardClick("BOARD_SLOT", 0, null);

    expect(blood.value).toBe(8);
  });
});

describe("handleCardClick – clears selection on validation error", () => {
  it("clears selection when buying unit with insufficient blood", () => {
    blood.value = 2;
    const unit = makeUnit();
    shopUnits.value = [makeShopSlot()];
    selection.value = { type: "SHOP_UNIT", index: 0, item: unit };

    handleCardClick("BOARD_SLOT", 0, null);

    expect(selection.value).toBeNull();
    expect(playSE).toHaveBeenCalledWith("error");
  });

  it("clears selection when equipping item to empty slot", () => {
    blood.value = 10;
    const item = makeItem();
    shopItems.value = [makeShopItemSlot()];
    selection.value = { type: "SHOP_ITEM", index: 0, item };

    handleCardClick("BOARD_SLOT", 0, null);

    expect(selection.value).toBeNull();
    expect(playSE).toHaveBeenCalledWith("error");
  });
});
