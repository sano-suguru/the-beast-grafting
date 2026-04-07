import {
  setupNight,
  rollShop,
  handleFreezeClick,
  executeSellUnit,
  useCultistAbility,
} from "./shop-actions";
import {
  origin,
  blood,
  round,
  board,
  freeRoll,
  cultistUsed,
  life,
  trophy,
  selection,
  shopUnits,
  shopItems,
  currentEnemyTeam,
  onboardingStep,
  activeEvent,
  canUndo,
  shopLocked,
  shopActionError,
  currentRunId,
  rotRingUses,
  showHelpOverlay,
  phase,
} from "./game-store";
import { makeUnit } from "../../engine/test-helpers";
import { makeShopState, toBoardUnit, stubFetch, shopRoute } from "./test-helpers";

beforeEach(() => {
  phase.value = "SHOP";
  origin.value = null;
  blood.value = 10;
  round.value = 1;
  board.value = [null, null, null, null, null];
  freeRoll.value = false;
  cultistUsed.value = false;
  life.value = 5;
  trophy.value = 0;
  selection.value = null;
  shopUnits.value = [];
  shopItems.value = [];
  currentEnemyTeam.value = null;
  onboardingStep.value = null;
  activeEvent.value = null;
  canUndo.value = false;
  shopLocked.value = false;
  currentRunId.value = "test-run-id";
  rotRingUses.value = 0;
  showHelpOverlay.value = false;
  vi.restoreAllMocks();
});

function stubError() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "fail" }), { status: 500 })),
  );
}

describe("setupNight", () => {
  it("applies shop state from API response", async () => {
    const unit = makeUnit({ id: "rat" });
    const state = makeShopState({
      blood: 10,
      shopUnits: [{ unit: toBoardUnit(unit), frozen: false, eventSourced: false }],
      freeRoll: true,
      round: 2,
    });
    stubFetch(shopRoute(state));

    await setupNight("test-run-id", true);

    expect(blood.value).toBe(10);
    expect(freeRoll.value).toBe(true);
    expect(round.value).toBe(2);
    expect(shopUnits.value).toHaveLength(1);
    expect(shopUnits.value[0]!.unit.id).toBe("rat");
  });

  it("sends runId and tutorial flag to the server", async () => {
    const spy = stubFetch(shopRoute(makeShopState()));
    await setupNight("run-123", true);
    const body = JSON.parse(spy.mock.calls[0]![1]!.body as string);
    expect(spy.mock.calls[0]![0]).toBe("/api/shop/setup");
    expect(body).toEqual({ runId: "run-123", useTutorialShop: true });
  });

  it("clears selection via applyShopState", async () => {
    selection.value = { type: "BOARD_UNIT", index: 0, item: makeUnit() };
    stubFetch(shopRoute(makeShopState()));
    await setupNight("test-run-id");
    expect(selection.value).toBeNull();
  });

  it("sets currentEnemyTeam to null via applyShopState", async () => {
    currentEnemyTeam.value = {
      teamName: "test",
      teamType: "同業者",
      units: [],
      round: null,
      life: null,
      trophy: null,
    };
    stubFetch(shopRoute(makeShopState()));
    await setupNight("test-run-id");
    expect(currentEnemyTeam.value).toBeNull();
  });

  it("resets cultistUsed from API response", async () => {
    cultistUsed.value = true;
    stubFetch(shopRoute(makeShopState({ cultistUsed: false })));
    await setupNight("test-run-id");
    expect(cultistUsed.value).toBe(false);
  });

  it("returns error sound on API failure", async () => {
    stubError();
    const se = await setupNight("test-run-id");
    expect(se).toBe("error");
  });

  it("sets shopLocked during call and clears after", async () => {
    stubFetch(shopRoute(makeShopState()));
    await setupNight("test-run-id");
    expect(shopLocked.value).toBe(false);
  });
});

describe("rollShop", () => {
  it("calls API and applies response", async () => {
    const unit = makeUnit({ id: "bat" });
    stubFetch(
      shopRoute(
        makeShopState({
          blood: 9,
          shopUnits: [{ unit: toBoardUnit(unit), frozen: false, eventSourced: false }],
        }),
      ),
    );
    const se = await rollShop();
    expect(blood.value).toBe(9);
    expect(shopUnits.value).toHaveLength(1);
    expect(se).toBe("select");
  });

  it("does nothing when shopLocked", () => {
    const spy = stubFetch(shopRoute(makeShopState()));
    shopLocked.value = true;
    void rollShop();
    expect(spy).not.toHaveBeenCalled();
  });

  it("does nothing when activeEvent has lockRoll", () => {
    const spy = stubFetch(shopRoute(makeShopState()));
    activeEvent.value = { lockRoll: true } as typeof activeEvent.value;
    void rollShop();
    expect(spy).not.toHaveBeenCalled();
  });

  it("does nothing without runId", () => {
    const spy = stubFetch(shopRoute(makeShopState()));
    currentRunId.value = null;
    void rollShop();
    expect(spy).not.toHaveBeenCalled();
  });

  it("advances onboardingStep from roll to battle", async () => {
    onboardingStep.value = "roll";
    stubFetch(shopRoute(makeShopState()));
    await rollShop();
    expect(onboardingStep.value).toBe("battle");
  });

  it("returns error sound on API failure", async () => {
    stubError();
    const se = await rollShop();
    expect(se).toBe("error");
  });
});

describe("handleFreezeClick", () => {
  it("calls API with correct params for unit freeze", async () => {
    const spy = stubFetch(
      shopRoute(
        makeShopState({
          shopUnits: [{ unit: toBoardUnit(makeUnit()), frozen: true, eventSourced: false }],
        }),
      ),
    );
    await handleFreezeClick("unit", 0, true);
    const body = JSON.parse(spy.mock.calls[0]![1]!.body as string);
    expect(body).toMatchObject({ runId: "test-run-id", slotType: "unit", index: 0, frozen: true });
    expect(shopUnits.value[0]!.frozen).toBe(true);
  });

  it("calls API for item freeze", async () => {
    const item = {
      id: "iron_plate" as const,
      name: "鉄板",
      cost: 3,
      atk: 0,
      hp: 2,
      equip: "iron" as const,
      skillText: "",
      lore: "",
    };
    stubFetch(shopRoute(makeShopState({ shopItems: [{ item, frozen: true }] })));
    await handleFreezeClick("item", 0, true);
    expect(shopItems.value[0]!.frozen).toBe(true);
  });

  it("does nothing when shopLocked", () => {
    const spy = stubFetch(shopRoute(makeShopState()));
    shopLocked.value = true;
    void handleFreezeClick("unit", 0, true);
    expect(spy).not.toHaveBeenCalled();
  });

  it("does nothing without runId", () => {
    const spy = stubFetch(shopRoute(makeShopState()));
    currentRunId.value = null;
    void handleFreezeClick("unit", 0, true);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("executeSellUnit", () => {
  it("calls API and applies response on sell", async () => {
    const unit = makeUnit({ id: "hound" });
    board.value = [unit, null, null, null, null];
    selection.value = { type: "BOARD_UNIT", index: 0, item: unit };
    stubFetch(shopRoute(makeShopState({ blood: 11, board: [null, null, null, null, null] })));
    const se = await executeSellUnit();
    expect(blood.value).toBe(11);
    expect(board.value[0]).toBeNull();
    expect(selection.value).toBeNull();
    expect(se).toBe("graft");
  });

  it("returns error sound without BOARD_UNIT selection", async () => {
    const spy = stubFetch(shopRoute(makeShopState()));
    selection.value = null;
    const se = await executeSellUnit();
    expect(spy).not.toHaveBeenCalled();
    expect(se).toBe("error");
  });

  it("does nothing when shopLocked", () => {
    const spy = stubFetch(shopRoute(makeShopState()));
    shopLocked.value = true;
    selection.value = { type: "BOARD_UNIT", index: 0, item: makeUnit() };
    void executeSellUnit();
    expect(spy).not.toHaveBeenCalled();
  });

  it("does nothing without runId", () => {
    const spy = stubFetch(shopRoute(makeShopState()));
    currentRunId.value = null;
    selection.value = { type: "BOARD_UNIT", index: 0, item: makeUnit() };
    void executeSellUnit();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("conflict handling", () => {
  it("clears selection on conflict when resync fails", async () => {
    selection.value = { type: "BOARD_UNIT", index: 0, item: makeUnit() };
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: "conflict" }), { status: 409 }),
          );
        }
        return Promise.resolve(new Response(JSON.stringify({ error: "fail" }), { status: 500 }));
      }),
    );

    const se = await rollShop();

    expect(selection.value).toBeNull();
    expect(se).toBe("error");
    expect(shopActionError.value).not.toBeNull();
  });
});

describe("useCultistAbility", () => {
  it("calls API and applies response", async () => {
    stubFetch(shopRoute(makeShopState({ blood: 13, life: 4, cultistUsed: true })));
    const se = await useCultistAbility();
    expect(blood.value).toBe(13);
    expect(life.value).toBe(4);
    expect(cultistUsed.value).toBe(true);
    expect(se).toBe("graft");
  });

  it("does nothing when shopLocked", () => {
    const spy = stubFetch(shopRoute(makeShopState()));
    shopLocked.value = true;
    void useCultistAbility();
    expect(spy).not.toHaveBeenCalled();
  });

  it("does nothing without runId", () => {
    const spy = stubFetch(shopRoute(makeShopState()));
    currentRunId.value = null;
    void useCultistAbility();
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns error sound on API failure", async () => {
    stubError();
    const se = await useCultistAbility();
    expect(se).toBe("error");
  });
});
