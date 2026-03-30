vi.mock("../engine/audio", () => ({
  initAudio: vi.fn(),
  playSE: vi.fn(),
}));

vi.mock("../api/shop-client", () => ({
  setupShop: vi.fn(),
  rollShop: vi.fn(),
  dismissEvent: vi.fn(),
  freezeSlot: vi.fn(),
  sellUnit: vi.fn(),
  useCultist: vi.fn(),
}));

import { playSE } from "../engine/audio";
import {
  setupShop as apiSetupShop,
  rollShop as apiRollShop,
  dismissEvent as apiDismissEvent,
  freezeSlot as apiFreezeSlot,
  sellUnit as apiSellUnit,
  useCultist as apiUseCultist,
} from "../api/shop-client";
import {
  setupNight,
  rollShop,
  handleFreezeClick,
  executeSellUnit,
  useCultistAbility,
  dismissEvent,
} from "./shop-actions";
import {
  origin,
  blood,
  round,
  board,
  freeRoll,
  cultistUsed,
  sanity,
  trophy,
  selection,
  shopUnits,
  shopItems,
  currentEnemyTeam,
  onboardingStep,
  activeEvent,
  canUndo,
  shopLocked,
  currentRunId,
  rotRingUses,
  showHelpOverlay,
  phase,
} from "./game-store";
import { makeUnit } from "../../engine/test-helpers";
import { ok, err } from "../../shared/errors";
import { makeShopState, toBoardUnit } from "./test-helpers";

beforeEach(() => {
  phase.value = "SHOP";
  origin.value = null;
  blood.value = 10;
  round.value = 1;
  board.value = [null, null, null, null, null];
  freeRoll.value = false;
  cultistUsed.value = false;
  sanity.value = 5;
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
  vi.clearAllMocks();
});

describe("setupNight", () => {
  it("applies shop state from API response", async () => {
    const unit = makeUnit({ id: "rat" });
    const state = makeShopState({
      blood: 10,
      shopUnits: [{ unit: toBoardUnit(unit), frozen: false }],
      freeRoll: true,
      round: 2,
    });
    vi.mocked(apiSetupShop).mockResolvedValue(ok(state));

    await setupNight("test-run-id", true);

    expect(blood.value).toBe(10);
    expect(freeRoll.value).toBe(true);
    expect(round.value).toBe(2);
    expect(shopUnits.value).toHaveLength(1);
    expect(shopUnits.value[0]!.unit.id).toBe("rat");
  });

  it("calls apiSetupShop with runId and tutorial flag", async () => {
    vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState()));
    await setupNight("run-123", true);
    expect(apiSetupShop).toHaveBeenCalledWith("run-123", true);
  });

  it("clears selection via applyShopState", async () => {
    selection.value = { type: "BOARD_UNIT", index: 0, item: makeUnit() };
    vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState()));
    await setupNight("test-run-id");
    expect(selection.value).toBeNull();
  });

  it("sets currentEnemyTeam to null via applyShopState", async () => {
    currentEnemyTeam.value = {
      teamName: "test",
      teamType: "同業者",
      units: [],
    };
    vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState()));
    await setupNight("test-run-id");
    expect(currentEnemyTeam.value).toBeNull();
  });

  it("resets cultistUsed from API response", async () => {
    cultistUsed.value = true;
    vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState({ cultistUsed: false })));
    await setupNight("test-run-id");
    expect(cultistUsed.value).toBe(false);
  });

  it("plays error on API failure", async () => {
    vi.mocked(apiSetupShop).mockResolvedValue(
      err({ type: "API_FETCH_FAILED", status: 500, cause: null }),
    );
    await setupNight("test-run-id");
    expect(playSE).toHaveBeenCalledWith("error");
  });

  it("sets shopLocked during call and clears after", async () => {
    vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState()));
    await setupNight("test-run-id");
    expect(shopLocked.value).toBe(false);
  });
});

describe("rollShop", () => {
  it("calls API and applies response", async () => {
    const unit = makeUnit({ id: "bat" });
    vi.mocked(apiRollShop).mockResolvedValue(
      ok(makeShopState({ blood: 9, shopUnits: [{ unit: toBoardUnit(unit), frozen: false }] })),
    );
    rollShop();
    await vi.waitFor(() => expect(shopLocked.value).toBe(false));
    expect(blood.value).toBe(9);
    expect(shopUnits.value).toHaveLength(1);
    expect(playSE).toHaveBeenCalledWith("select");
  });

  it("does nothing when shopLocked", () => {
    shopLocked.value = true;
    rollShop();
    expect(apiRollShop).not.toHaveBeenCalled();
  });

  it("does nothing without runId", () => {
    currentRunId.value = null;
    rollShop();
    expect(apiRollShop).not.toHaveBeenCalled();
  });

  it("advances onboardingStep from roll to battle", async () => {
    onboardingStep.value = "roll";
    vi.mocked(apiRollShop).mockResolvedValue(ok(makeShopState()));
    rollShop();
    await vi.waitFor(() => expect(shopLocked.value).toBe(false));
    expect(onboardingStep.value).toBe("battle");
  });

  it("plays error on API failure", async () => {
    vi.mocked(apiRollShop).mockResolvedValue(
      err({ type: "API_FETCH_FAILED", status: 500, cause: null }),
    );
    rollShop();
    await vi.waitFor(() => expect(shopLocked.value).toBe(false));
    expect(playSE).toHaveBeenCalledWith("error");
  });
});

describe("handleFreezeClick", () => {
  it("calls API with correct params for unit freeze", async () => {
    vi.mocked(apiFreezeSlot).mockResolvedValue(
      ok(
        makeShopState({
          shopUnits: [{ unit: toBoardUnit(makeUnit()), frozen: true }],
        }),
      ),
    );
    handleFreezeClick(true, 0, true);
    await vi.waitFor(() => expect(shopLocked.value).toBe(false));
    expect(apiFreezeSlot).toHaveBeenCalledWith("test-run-id", true, 0, true);
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
    vi.mocked(apiFreezeSlot).mockResolvedValue(
      ok(makeShopState({ shopItems: [{ item, frozen: true }] })),
    );
    handleFreezeClick(false, 0, true);
    await vi.waitFor(() => expect(shopLocked.value).toBe(false));
    expect(apiFreezeSlot).toHaveBeenCalledWith("test-run-id", false, 0, true);
    expect(shopItems.value[0]!.frozen).toBe(true);
  });

  it("does nothing when shopLocked", () => {
    shopLocked.value = true;
    handleFreezeClick(true, 0, true);
    expect(apiFreezeSlot).not.toHaveBeenCalled();
  });

  it("does nothing without runId", () => {
    currentRunId.value = null;
    handleFreezeClick(true, 0, true);
    expect(apiFreezeSlot).not.toHaveBeenCalled();
  });
});

describe("executeSellUnit", () => {
  it("calls API and applies response on sell", async () => {
    const unit = makeUnit({ id: "hound" });
    board.value = [unit, null, null, null, null];
    selection.value = { type: "BOARD_UNIT", index: 0, item: unit };
    vi.mocked(apiSellUnit).mockResolvedValue(
      ok(makeShopState({ blood: 11, board: [null, null, null, null, null] })),
    );
    executeSellUnit();
    await vi.waitFor(() => expect(shopLocked.value).toBe(false));
    expect(blood.value).toBe(11);
    expect(board.value[0]).toBeNull();
    expect(selection.value).toBeNull();
    expect(playSE).toHaveBeenCalledWith("graft");
  });

  it("does nothing without BOARD_UNIT selection", () => {
    selection.value = null;
    executeSellUnit();
    expect(apiSellUnit).not.toHaveBeenCalled();
    expect(playSE).toHaveBeenCalledWith("error");
  });

  it("does nothing when shopLocked", () => {
    shopLocked.value = true;
    selection.value = { type: "BOARD_UNIT", index: 0, item: makeUnit() };
    executeSellUnit();
    expect(apiSellUnit).not.toHaveBeenCalled();
  });

  it("does nothing without runId", () => {
    currentRunId.value = null;
    selection.value = { type: "BOARD_UNIT", index: 0, item: makeUnit() };
    executeSellUnit();
    expect(apiSellUnit).not.toHaveBeenCalled();
  });
});

describe("useCultistAbility", () => {
  it("calls API and applies response", async () => {
    vi.mocked(apiUseCultist).mockResolvedValue(
      ok(makeShopState({ blood: 13, sanity: 4, cultistUsed: true })),
    );
    useCultistAbility();
    await vi.waitFor(() => expect(shopLocked.value).toBe(false));
    expect(blood.value).toBe(13);
    expect(sanity.value).toBe(4);
    expect(cultistUsed.value).toBe(true);
    expect(playSE).toHaveBeenCalledWith("graft");
  });

  it("does nothing when shopLocked", () => {
    shopLocked.value = true;
    useCultistAbility();
    expect(apiUseCultist).not.toHaveBeenCalled();
  });

  it("does nothing without runId", () => {
    currentRunId.value = null;
    useCultistAbility();
    expect(apiUseCultist).not.toHaveBeenCalled();
  });

  it("plays error on API failure", async () => {
    vi.mocked(apiUseCultist).mockResolvedValue(
      err({ type: "API_FETCH_FAILED", status: 500, cause: null }),
    );
    useCultistAbility();
    await vi.waitFor(() => expect(shopLocked.value).toBe(false));
    expect(playSE).toHaveBeenCalledWith("error");
  });
});

describe("dismissEvent", () => {
  it("calls API and applies response", async () => {
    activeEvent.value = { id: "vial" } as typeof activeEvent.value;
    vi.mocked(apiDismissEvent).mockResolvedValue(
      ok(makeShopState({ blood: 10, activeEvent: null })),
    );
    dismissEvent();
    await vi.waitFor(() => expect(shopLocked.value).toBe(false));
    expect(activeEvent.value).toBeNull();
    expect(blood.value).toBe(10);
    expect(playSE).toHaveBeenCalledWith("select");
  });

  it("does nothing when shopLocked", () => {
    shopLocked.value = true;
    dismissEvent();
    expect(apiDismissEvent).not.toHaveBeenCalled();
  });

  it("does nothing without runId", () => {
    currentRunId.value = null;
    dismissEvent();
    expect(apiDismissEvent).not.toHaveBeenCalled();
  });

  it("plays error on API failure", async () => {
    vi.mocked(apiDismissEvent).mockResolvedValue(
      err({ type: "API_FETCH_FAILED", status: 500, cause: null }),
    );
    dismissEvent();
    await vi.waitFor(() => expect(shopLocked.value).toBe(false));
    expect(playSE).toHaveBeenCalledWith("error");
  });
});
