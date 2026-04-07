import { handleCardClick } from "./card-actions";
import {
  blood,
  board,
  shopUnits,
  shopItems,
  selection,
  onboardingStep,
  lastBattleResult,
  shopLocked,
  currentRunId,
  phase,
} from "./game-store";
import { makeUnit } from "../../engine/test-helpers";
import type { ItemData, ShopSlot, ShopItemSlot } from "../types";
import { makeShopState, toBoardUnit, stubFetch, shopRoute } from "./test-helpers";

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
  } as ItemData;
}

function makeShopSlot(overrides: Partial<ReturnType<typeof makeUnit>> = {}): ShopSlot {
  return { unit: makeUnit(overrides), frozen: false, eventSourced: false };
}

function makeShopItemSlot(overrides: Partial<ItemData> = {}): ShopItemSlot {
  return { item: makeItem(overrides), frozen: false };
}

beforeEach(() => {
  phase.value = "SHOP";
  blood.value = 10;
  board.value = [null, null, null, null, null];
  shopUnits.value = [];
  shopItems.value = [];
  selection.value = null;
  onboardingStep.value = null;
  lastBattleResult.value = null;
  shopLocked.value = false;
  currentRunId.value = "test-run-id";
  vi.restoreAllMocks();
});

describe("handleCardClick – selection / deselection", () => {
  it("deselects when clicking the same shop unit", async () => {
    const unit = makeUnit();
    selection.value = { type: "SHOP_UNIT", index: 0, item: unit };
    const se = await handleCardClick("SHOP_UNIT", 0, unit);
    expect(selection.value).toBeNull();
    expect(se).toBe("select");
  });

  it("deselects when clicking the same shop item", async () => {
    const item = makeItem();
    selection.value = { type: "SHOP_ITEM", index: 1, item };
    await handleCardClick("SHOP_ITEM", 1, item);
    expect(selection.value).toBeNull();
  });

  it("deselects when clicking the same board unit", async () => {
    const unit = makeUnit();
    selection.value = { type: "BOARD_UNIT", index: 2, item: unit };
    await handleCardClick("BOARD_UNIT", 2, unit);
    expect(selection.value).toBeNull();
  });

  it("selects a shop unit", async () => {
    const unit = makeUnit();
    const se = await handleCardClick("SHOP_UNIT", 1, unit);
    expect(selection.value).toEqual({ type: "SHOP_UNIT", index: 1, item: unit });
    expect(se).toBe("select");
  });

  it("selects a shop item", async () => {
    const item = makeItem();
    const se = await handleCardClick("SHOP_ITEM", 0, item);
    expect(selection.value).toEqual({ type: "SHOP_ITEM", index: 0, item });
    expect(se).toBe("select");
  });

  it("selects a board unit from occupied slot", async () => {
    const unit = makeUnit();
    board.value = [unit, null, null, null, null];
    const se = await handleCardClick("BOARD_SLOT", 0, null);
    expect(selection.value).toEqual({ type: "BOARD_UNIT", index: 0, item: unit });
    expect(se).toBe("select");
  });

  it("does nothing when clicking empty board slot with no selection", async () => {
    await handleCardClick("BOARD_SLOT", 3, null);
    expect(selection.value).toBeNull();
  });

  it("does not select when item is null for SHOP_UNIT", async () => {
    await handleCardClick("SHOP_UNIT", 0, null);
    expect(selection.value).toBeNull();
  });
});

describe("handleCardClick – buy unit to empty slot", () => {
  it("calls API and applies response on buy", async () => {
    const unit = makeUnit({ id: "hound" });
    shopUnits.value = [makeShopSlot({ id: "hound" })];
    selection.value = { type: "SHOP_UNIT", index: 0, item: unit };

    stubFetch(
      shopRoute(
        makeShopState({
          blood: 7,
          board: [toBoardUnit(unit), null, null, null, null],
          shopUnits: [null],
        }),
      ),
    );

    const se = await handleCardClick("BOARD_SLOT", 0, null);

    expect(blood.value).toBe(7);
    expect(board.value[0]!.id).toBe("hound");
    expect(shopUnits.value[0]).toBeNull();
    expect(selection.value).toBeNull();
    expect(se).toBe("buy");
  });

  it("returns error and does nothing when blood < 3", async () => {
    blood.value = 2;
    const spy = stubFetch(shopRoute(makeShopState()));
    const unit = makeUnit();
    shopUnits.value = [makeShopSlot()];
    selection.value = { type: "SHOP_UNIT", index: 0, item: unit };

    const se = await handleCardClick("BOARD_SLOT", 0, null);

    expect(selection.value).toBeNull();
    expect(se).toBe("error");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("handleCardClick – graft shop unit onto board unit", () => {
  it("calls API for graft when same ID and level < 3", async () => {
    const shopUnit = makeUnit({ id: "hound", uid: "shop-1" });
    const boardUnit = makeUnit({ id: "hound", level: 1, uid: "board-1" });
    board.value = [boardUnit, null, null, null, null];
    shopUnits.value = [makeShopSlot({ id: "hound" })];
    selection.value = { type: "SHOP_UNIT", index: 0, item: shopUnit };

    const graftedUnit = makeUnit({ id: "hound", level: 2, uid: "board-1" });
    stubFetch(
      shopRoute(
        makeShopState({
          blood: 7,
          board: [toBoardUnit(graftedUnit), null, null, null, null],
          shopUnits: [null],
        }),
      ),
    );

    const se = await handleCardClick("BOARD_SLOT", 0, null);

    expect(blood.value).toBe(7);
    expect(board.value[0]!.level).toBe(2);
    expect(se).toBe("graft");
  });

  it("returns error when IDs differ", async () => {
    const spy = stubFetch(shopRoute(makeShopState()));
    const shopUnit = makeUnit({ id: "bat" });
    const boardUnit = makeUnit({ id: "hound" });
    board.value = [boardUnit, null, null, null, null];
    shopUnits.value = [makeShopSlot({ id: "bat" })];
    selection.value = { type: "SHOP_UNIT", index: 0, item: shopUnit };

    const se = await handleCardClick("BOARD_SLOT", 0, null);

    expect(blood.value).toBe(10);
    expect(se).toBe("error");
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns error when target is level 3", async () => {
    const spy = stubFetch(shopRoute(makeShopState()));
    const shopUnit = makeUnit({ id: "hound" });
    const boardUnit = makeUnit({ id: "hound", level: 3 });
    board.value = [boardUnit, null, null, null, null];
    shopUnits.value = [makeShopSlot({ id: "hound" })];
    selection.value = { type: "SHOP_UNIT", index: 0, item: shopUnit };

    const se = await handleCardClick("BOARD_SLOT", 0, null);

    expect(blood.value).toBe(10);
    expect(se).toBe("error");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("handleCardClick – equip item onto board unit", () => {
  it("calls API and applies equip response", async () => {
    const item = makeItem({ cost: 2, atk: 1, hp: 3, equip: "iron" });
    const unit = makeUnit({ baseAtk: 5, baseHp: 5, equip: null });
    board.value = [unit, null, null, null, null];
    shopItems.value = [makeShopItemSlot({ cost: 2, atk: 1, hp: 3, equip: "iron" })];
    selection.value = { type: "SHOP_ITEM", index: 0, item };

    const equippedUnit = makeUnit({
      baseAtk: 5,
      baseHp: 5,
      buffAtk: 1,
      buffHp: 3,
      equip: "iron",
    });
    stubFetch(
      shopRoute(
        makeShopState({
          blood: 8,
          board: [toBoardUnit(equippedUnit), null, null, null, null],
          shopItems: [null],
        }),
      ),
    );

    const se = await handleCardClick("BOARD_SLOT", 0, null);

    expect(blood.value).toBe(8);
    expect(board.value[0]!.baseAtk + board.value[0]!.buffAtk).toBe(6);
    expect(board.value[0]!.baseHp + board.value[0]!.buffHp).toBe(8);
    expect(board.value[0]!.equip).toBe("iron");
    expect(shopItems.value[0]).toBeNull();
    expect(selection.value).toBeNull();
    expect(se).toBe("graft");
  });

  it("returns error when target slot is empty", async () => {
    const spy = stubFetch(shopRoute(makeShopState()));
    const item = makeItem();
    shopItems.value = [makeShopItemSlot()];
    selection.value = { type: "SHOP_ITEM", index: 0, item };

    const se = await handleCardClick("BOARD_SLOT", 0, null);

    expect(se).toBe("error");
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns error when blood is insufficient", async () => {
    blood.value = 1;
    const spy = stubFetch(shopRoute(makeShopState()));
    const item = makeItem({ cost: 3 });
    const unit = makeUnit();
    board.value = [unit, null, null, null, null];
    shopItems.value = [makeShopItemSlot({ cost: 3 })];
    selection.value = { type: "SHOP_ITEM", index: 0, item };

    const se = await handleCardClick("BOARD_SLOT", 0, null);

    expect(blood.value).toBe(1);
    expect(se).toBe("error");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("handleCardClick – clears selection on validation error", () => {
  it("clears selection when buying unit with insufficient blood", async () => {
    blood.value = 2;
    const unit = makeUnit();
    shopUnits.value = [makeShopSlot()];
    selection.value = { type: "SHOP_UNIT", index: 0, item: unit };

    const se = await handleCardClick("BOARD_SLOT", 0, null);

    expect(selection.value).toBeNull();
    expect(se).toBe("error");
  });

  it("clears selection when equipping item to empty slot", async () => {
    blood.value = 10;
    const item = makeItem();
    shopItems.value = [makeShopItemSlot()];
    selection.value = { type: "SHOP_ITEM", index: 0, item };

    const se = await handleCardClick("BOARD_SLOT", 0, null);

    expect(selection.value).toBeNull();
    expect(se).toBe("error");
  });
});

describe("handleCardClick – REWARD_UNIT selection / deselection", () => {
  it("selects a reward unit", async () => {
    const unit = makeUnit({ id: "hound" });
    const se = await handleCardClick("REWARD_UNIT", 0, unit);
    expect(selection.value).toEqual({ type: "REWARD_UNIT", index: 0, item: unit });
    expect(se).toBe("select");
  });

  it("deselects when clicking the same reward unit", async () => {
    const unit = makeUnit({ id: "hound" });
    selection.value = { type: "REWARD_UNIT", index: 0, item: unit };
    const se = await handleCardClick("REWARD_UNIT", 0, unit);
    expect(selection.value).toBeNull();
    expect(se).toBe("select");
  });
});

describe("handleCardClick – REWARD_UNIT buy to empty slot", () => {
  it("calls buyReward API and applies response", async () => {
    const unit = makeUnit({ id: "hound" });
    selection.value = { type: "REWARD_UNIT", index: 0, item: unit };

    stubFetch(
      shopRoute(
        makeShopState({
          blood: 7,
          board: [toBoardUnit(unit), null, null, null, null],
          rewardSlots: [null],
        }),
      ),
    );

    const se = await handleCardClick("BOARD_SLOT", 0, null);

    expect(blood.value).toBe(7);
    expect(board.value[0]!.id).toBe("hound");
    expect(selection.value).toBeNull();
    expect(se).toBe("buy");
  });
});

describe("handleCardClick – REWARD_UNIT graft", () => {
  it("grafts when same ID and level < 3", async () => {
    const rewardUnit = makeUnit({ id: "hound", uid: "reward-1" });
    const boardUnit = makeUnit({ id: "hound", level: 1, uid: "board-1" });
    board.value = [boardUnit, null, null, null, null];
    selection.value = { type: "REWARD_UNIT", index: 0, item: rewardUnit };

    const graftedUnit = makeUnit({ id: "hound", level: 2, uid: "board-1" });
    stubFetch(
      shopRoute(
        makeShopState({
          blood: 7,
          board: [toBoardUnit(graftedUnit), null, null, null, null],
          rewardSlots: [null],
        }),
      ),
    );

    const se = await handleCardClick("BOARD_SLOT", 0, null);

    expect(blood.value).toBe(7);
    expect(board.value[0]!.level).toBe(2);
    expect(se).toBe("graft");
  });
});

describe("handleCardClick – REWARD_UNIT insufficient blood", () => {
  it("returns error when blood < 3", async () => {
    blood.value = 2;
    const spy = stubFetch(shopRoute(makeShopState()));
    const unit = makeUnit({ id: "hound" });
    selection.value = { type: "REWARD_UNIT", index: 0, item: unit };

    const se = await handleCardClick("BOARD_SLOT", 0, null);

    expect(selection.value).toBeNull();
    expect(se).toBe("error");
    expect(spy).not.toHaveBeenCalled();
  });
});
