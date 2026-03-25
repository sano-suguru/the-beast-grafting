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

describe("handleCardClick – board unit operations", () => {
  it("swaps board unit to empty slot", () => {
    const unit = makeUnit({ id: "hound" });
    board.value = [unit, null, null, null, null];
    selection.value = { type: "BOARD_UNIT", index: 0, item: unit };

    handleCardClick("BOARD_SLOT", 2, null);

    expect(board.value[0]).toBeNull();
    expect(board.value[2]).toBe(unit);
    expect(selection.value).toBeNull();
    expect(playSE).toHaveBeenCalledWith("buy");
  });

  it("swaps two board units", () => {
    const unitA = makeUnit({ id: "hound", uid: "a" });
    const unitB = makeUnit({ id: "bat", uid: "b" });
    board.value = [unitA, null, unitB, null, null];
    selection.value = { type: "BOARD_UNIT", index: 0, item: unitA };

    handleCardClick("BOARD_SLOT", 2, null);

    expect(board.value[0]).toBe(unitB);
    expect(board.value[2]).toBe(unitA);
  });

  it("grafts board unit onto matching board unit", () => {
    const unitA = makeUnit({ id: "hound", uid: "a", level: 1 });
    const unitB = makeUnit({ id: "hound", uid: "b", level: 1 });
    board.value = [unitA, null, unitB, null, null];
    selection.value = { type: "BOARD_UNIT", index: 0, item: unitA };

    handleCardClick("BOARD_SLOT", 2, null);

    expect(graftUnits).toHaveBeenCalledWith(unitB, unitA);
    expect(board.value[0]).toBeNull();
    expect(selection.value).toBeNull();
    expect(playSE).toHaveBeenCalledWith("graft");
  });
});

describe("handleCardClick – board slot bounds", () => {
  it("ignores index < 0", () => {
    const unit = makeUnit();
    selection.value = { type: "SHOP_UNIT", index: 0, item: unit };

    handleCardClick("BOARD_SLOT", -1, null);

    expect(blood.value).toBe(10);
  });

  it("ignores index > 4", () => {
    const unit = makeUnit();
    selection.value = { type: "SHOP_UNIT", index: 0, item: unit };

    handleCardClick("BOARD_SLOT", 5, null);

    expect(blood.value).toBe(10);
  });
});

describe("handleCardClick – onboarding transitions", () => {
  it("advances from buy to graft when same ID on board", () => {
    onboardingStep.value = "buy";
    const unit = makeUnit({ id: "rat" });
    const existingUnit = makeUnit({ id: "rat" });
    board.value = [existingUnit, null, null, null, null];
    shopUnits.value = [makeShopSlot({ id: "rat" })];
    selection.value = { type: "SHOP_UNIT", index: 0, item: unit };

    handleCardClick("BOARD_SLOT", 1, null);

    expect(onboardingStep.value).toBe("graft");
  });

  it("advances from buy to graft when shop has same ID", () => {
    onboardingStep.value = "buy";
    const unit = makeUnit({ id: "rat" });
    shopUnits.value = [makeShopSlot({ id: "rat" }), makeShopSlot({ id: "rat" })];
    selection.value = { type: "SHOP_UNIT", index: 0, item: unit };

    handleCardClick("BOARD_SLOT", 0, null);

    expect(onboardingStep.value).toBe("graft");
  });

  it("advances from buy to roll when no same ID available", () => {
    onboardingStep.value = "buy";
    const unit = makeUnit({ id: "rat" });
    shopUnits.value = [makeShopSlot({ id: "rat" }), makeShopSlot({ id: "bat" })];
    selection.value = { type: "SHOP_UNIT", index: 0, item: unit };

    handleCardClick("BOARD_SLOT", 0, null);

    expect(onboardingStep.value).toBe("roll");
  });

  it("advances from graft to roll after shop graft", () => {
    onboardingStep.value = "graft";
    const shopUnit = makeUnit({ id: "hound", uid: "s" });
    const boardUnit = makeUnit({ id: "hound", uid: "b", level: 1 });
    board.value = [boardUnit, null, null, null, null];
    shopUnits.value = [makeShopSlot({ id: "hound" })];
    selection.value = { type: "SHOP_UNIT", index: 0, item: shopUnit };

    handleCardClick("BOARD_SLOT", 0, null);

    expect(onboardingStep.value).toBe("roll");
  });

  it("advances from graft to roll after board graft", () => {
    onboardingStep.value = "graft";
    const unitA = makeUnit({ id: "hound", uid: "a", level: 1 });
    const unitB = makeUnit({ id: "hound", uid: "b", level: 1 });
    board.value = [unitA, null, unitB, null, null];
    selection.value = { type: "BOARD_UNIT", index: 0, item: unitA };

    handleCardClick("BOARD_SLOT", 2, null);

    expect(onboardingStep.value).toBe("roll");
  });
});

describe("handleCardClick – chalice trigger", () => {
  it("calls applyChaliceEffect when triggered", () => {
    vi.mocked(applyBuyEffects).mockReturnValueOnce({
      board: [null, null, null, null, null],
      chaliceTriggered: true,
      rotRingUses: 0,
    });

    const unit = makeUnit();
    shopUnits.value = [makeShopSlot()];
    shopItems.value = [makeShopItemSlot()];
    selection.value = { type: "SHOP_UNIT", index: 0, item: unit };

    handleCardClick("BOARD_SLOT", 0, null);

    expect(applyChaliceEffect).toHaveBeenCalledWith(shopItems.value);
  });
});
