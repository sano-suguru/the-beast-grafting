vi.mock("../engine/audio", () => ({
  initAudio: vi.fn(),
  playSE: vi.fn(),
}));

import { undoLastAction } from "./undo-actions";
import { playSE } from "../engine/audio";
import {
  blood,
  sanity,
  board,
  shopUnits,
  shopItems,
  freeRoll,
  cultistUsed,
  onboardingStep,
  rotRingUses,
  selection,
  canUndo,
  shopLocked,
  currentRunId,
  phase,
} from "./game-store";
import { makeUnit } from "../../engine/test-helpers";
import { makeShopState, toBoardUnit, stubFetch, shopRoute } from "./test-helpers";

beforeEach(() => {
  phase.value = "SHOP";
  blood.value = 10;
  sanity.value = 5;
  board.value = [makeUnit({ uid: "u1", baseAtk: 3 }), null, null, null, null];
  shopUnits.value = [];
  shopItems.value = [];
  freeRoll.value = false;
  cultistUsed.value = false;
  onboardingStep.value = null;
  rotRingUses.value = 0;
  selection.value = null;
  canUndo.value = true;
  shopLocked.value = false;
  currentRunId.value = "test-run-id";
  vi.restoreAllMocks();
});

describe("undoLastAction", () => {
  it("calls API and restores signals from response", async () => {
    const restoredUnit = makeUnit({ uid: "u1", baseAtk: 3 });
    const restoredShopUnit = makeUnit({ uid: "s1" });
    const state = makeShopState({
      blood: 10,
      sanity: 5,
      board: [toBoardUnit(restoredUnit), null, null, null, null],
      shopUnits: [{ unit: toBoardUnit(restoredShopUnit), frozen: false, eventSourced: false }],
      freeRoll: false,
      cultistUsed: false,
      rotRingUses: 0,
      canUndo: false,
    });
    stubFetch(shopRoute(state));

    blood.value = 0;
    sanity.value = 0;
    board.value = [null, null, null, null, null];

    undoLastAction();
    await vi.waitFor(() => expect(shopLocked.value).toBe(false));

    expect(blood.value).toBe(10);
    expect(sanity.value).toBe(5);
    expect(board.value[0]!.uid).toBe("u1");
    expect(shopUnits.value).toHaveLength(1);
    expect(selection.value).toBeNull();
    expect(playSE).toHaveBeenCalledWith("select");
  });

  it("clears selection after undo", async () => {
    stubFetch(shopRoute(makeShopState({ canUndo: false })));
    selection.value = { type: "BOARD_UNIT", index: 0, item: makeUnit() };
    undoLastAction();
    await vi.waitFor(() => expect(shopLocked.value).toBe(false));
    expect(selection.value).toBeNull();
  });

  it("sets canUndo to false after undo (single undo, not stack)", async () => {
    stubFetch(shopRoute(makeShopState({ canUndo: false })));
    undoLastAction();
    await vi.waitFor(() => expect(shopLocked.value).toBe(false));
    expect(canUndo.value).toBe(false);
  });

  it("does nothing when canUndo is false", () => {
    const spy = stubFetch(shopRoute(makeShopState()));
    canUndo.value = false;
    blood.value = 7;
    undoLastAction();
    expect(blood.value).toBe(7);
    expect(spy).not.toHaveBeenCalled();
  });

  it("does nothing when shopLocked", () => {
    const spy = stubFetch(shopRoute(makeShopState()));
    shopLocked.value = true;
    undoLastAction();
    expect(spy).not.toHaveBeenCalled();
  });

  it("does nothing without runId", () => {
    const spy = stubFetch(shopRoute(makeShopState()));
    currentRunId.value = null;
    undoLastAction();
    expect(spy).not.toHaveBeenCalled();
  });

  it("plays select sound effect on success", async () => {
    stubFetch(shopRoute(makeShopState()));
    undoLastAction();
    await vi.waitFor(() => expect(shopLocked.value).toBe(false));
    expect(vi.mocked(playSE)).toHaveBeenCalledWith("select");
  });

  it("plays error on API failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "fail" }), { status: 500 })),
    );
    undoLastAction();
    await vi.waitFor(() => expect(shopLocked.value).toBe(false));
    expect(playSE).toHaveBeenCalledWith("error");
  });
});
