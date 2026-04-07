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
import type { ShopSlot } from "../types";
import { makeShopState, toBoardUnit, stubFetch, shopRoute } from "./test-helpers";

function makeShopSlot(overrides: Partial<ReturnType<typeof makeUnit>> = {}): ShopSlot {
  return { unit: makeUnit(overrides), frozen: false, eventSourced: false };
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

describe("handleCardClick – board unit operations", () => {
  it("calls API to swap board unit to empty slot", async () => {
    const unit = makeUnit({ id: "hound" });
    board.value = [unit, null, null, null, null];
    selection.value = { type: "BOARD_UNIT", index: 0, item: unit };

    stubFetch(shopRoute(makeShopState({ board: [null, null, toBoardUnit(unit), null, null] })));

    const se = await handleCardClick("BOARD_SLOT", 2, null);

    expect(board.value[0]).toBeNull();
    expect(board.value[2]!.id).toBe("hound");
    expect(selection.value).toBeNull();
    expect(se).toBe("buy");
  });

  it("calls API to swap two board units", async () => {
    const unitA = makeUnit({ id: "hound", uid: "a" });
    const unitB = makeUnit({ id: "bat", uid: "b" });
    board.value = [unitA, null, unitB, null, null];
    selection.value = { type: "BOARD_UNIT", index: 0, item: unitA };

    stubFetch(
      shopRoute(
        makeShopState({
          board: [toBoardUnit(unitB), null, toBoardUnit(unitA), null, null],
        }),
      ),
    );

    await handleCardClick("BOARD_SLOT", 2, null);

    expect(board.value[0]!.uid).toBe("b");
    expect(board.value[2]!.uid).toBe("a");
  });

  it("calls API to graft board unit onto matching board unit", async () => {
    const unitA = makeUnit({ id: "hound", uid: "a", level: 1 });
    const unitB = makeUnit({ id: "hound", uid: "b", level: 1 });
    board.value = [unitA, null, unitB, null, null];
    selection.value = { type: "BOARD_UNIT", index: 0, item: unitA };

    const graftedUnit = makeUnit({ id: "hound", uid: "b", level: 2 });
    stubFetch(
      shopRoute(makeShopState({ board: [null, null, toBoardUnit(graftedUnit), null, null] })),
    );

    const se = await handleCardClick("BOARD_SLOT", 2, null);

    expect(board.value[0]).toBeNull();
    expect(board.value[2]!.level).toBe(2);
    expect(selection.value).toBeNull();
    expect(se).toBe("graft");
  });
});

describe("handleCardClick – board slot bounds", () => {
  it("ignores index < 0", () => {
    const spy = stubFetch(shopRoute(makeShopState()));
    const unit = makeUnit();
    selection.value = { type: "SHOP_UNIT", index: 0, item: unit };

    void handleCardClick("BOARD_SLOT", -1, null);

    expect(blood.value).toBe(10);
    expect(spy).not.toHaveBeenCalled();
  });

  it("ignores index > 4", () => {
    const spy = stubFetch(shopRoute(makeShopState()));
    const unit = makeUnit();
    selection.value = { type: "SHOP_UNIT", index: 0, item: unit };

    void handleCardClick("BOARD_SLOT", 5, null);

    expect(blood.value).toBe(10);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("handleCardClick – onboarding transitions", () => {
  it("advances from buy to graft when same ID on board after buy", async () => {
    onboardingStep.value = "buy";
    const unit = makeUnit({ id: "rat" });
    const existingUnit = makeUnit({ id: "rat", uid: "existing" });
    board.value = [existingUnit, null, null, null, null];
    shopUnits.value = [makeShopSlot({ id: "rat" })];
    selection.value = { type: "SHOP_UNIT", index: 0, item: unit };

    stubFetch(
      shopRoute(
        makeShopState({
          blood: 7,
          board: [toBoardUnit(existingUnit), toBoardUnit(unit), null, null, null],
          shopUnits: [null],
        }),
      ),
    );

    await handleCardClick("BOARD_SLOT", 1, null);

    expect(onboardingStep.value).toBe("graft");
  });

  it("advances from buy to roll when no same ID available", async () => {
    onboardingStep.value = "buy";
    const unit = makeUnit({ id: "rat" });
    shopUnits.value = [makeShopSlot({ id: "rat" }), makeShopSlot({ id: "bat" })];
    selection.value = { type: "SHOP_UNIT", index: 0, item: unit };

    stubFetch(
      shopRoute(
        makeShopState({
          blood: 7,
          board: [toBoardUnit(unit), null, null, null, null],
          shopUnits: [
            null,
            { unit: toBoardUnit(makeUnit({ id: "bat" })), frozen: false, eventSourced: false },
          ],
        }),
      ),
    );

    await handleCardClick("BOARD_SLOT", 0, null);

    expect(onboardingStep.value).toBe("roll");
  });

  it("advances from graft to roll after shop graft", async () => {
    onboardingStep.value = "graft";
    const shopUnit = makeUnit({ id: "hound", uid: "s" });
    const boardUnit = makeUnit({ id: "hound", uid: "b", level: 1 });
    board.value = [boardUnit, null, null, null, null];
    shopUnits.value = [makeShopSlot({ id: "hound" })];
    selection.value = { type: "SHOP_UNIT", index: 0, item: shopUnit };

    const graftedUnit = makeUnit({ id: "hound", uid: "b", level: 2 });
    stubFetch(
      shopRoute(
        makeShopState({
          blood: 7,
          board: [toBoardUnit(graftedUnit), null, null, null, null],
          shopUnits: [null],
        }),
      ),
    );

    await handleCardClick("BOARD_SLOT", 0, null);

    expect(onboardingStep.value).toBe("roll");
  });

  it("advances from graft to roll after board graft", async () => {
    onboardingStep.value = "graft";
    const unitA = makeUnit({ id: "hound", uid: "a", level: 1 });
    const unitB = makeUnit({ id: "hound", uid: "b", level: 1 });
    board.value = [unitA, null, unitB, null, null];
    selection.value = { type: "BOARD_UNIT", index: 0, item: unitA };

    const graftedUnit = makeUnit({ id: "hound", uid: "b", level: 2 });
    stubFetch(
      shopRoute(makeShopState({ board: [null, null, toBoardUnit(graftedUnit), null, null] })),
    );

    await handleCardClick("BOARD_SLOT", 2, null);

    expect(onboardingStep.value).toBe("roll");
  });
});
