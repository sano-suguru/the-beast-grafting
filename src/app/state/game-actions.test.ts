vi.mock("../engine/audio", () => ({
  initAudio: vi.fn(),
  playSE: vi.fn(),
}));

vi.mock("../api/fetch", async () => {
  const { ok } = await import("../../shared/errors");
  return {
    apiFetch: vi.fn(),
    ensureSession: vi.fn().mockResolvedValue(ok(undefined)),
  };
});

vi.mock("../api/run-client", () => ({
  startRun: vi.fn(),
  getCurrentRun: vi.fn(),
}));

vi.mock("../api/shop-client", () => ({
  setupShop: vi.fn(),
}));

import { startGame } from "./game-actions";
import { startRun, getCurrentRun } from "../api/run-client";
import { setupShop as apiSetupShop } from "../api/shop-client";
import { tutorialDone } from "./tutorial";
import { ok, err } from "../../shared/errors";
import {
  phase,
  origin,
  blood,
  sanity,
  trophy,
  round,
  board,
  lastBattleResult,
  currentRunId,
  onboardingStep,
  shopUnits,
  activeEvent,
  gameLoading,
  startGameError,
} from "./game-store";
import { makeUnit } from "../../engine/test-helpers";
import type { RunState } from "../../shared/api-types";
import { makeShopState, toBoardUnit } from "./test-helpers";

function defaultRun(overrides: Partial<RunState> = {}): RunState {
  return {
    id: "run-1",
    round: 1,
    sanity: 5,
    trophy: 0,
    status: "active",
    originId: "thief",
    ...overrides,
  };
}

beforeEach(() => {
  phase.value = "TITLE";
  origin.value = null;
  blood.value = 0;
  sanity.value = 0;
  trophy.value = 0;
  round.value = 1;
  board.value = [null, null, null, null, null];
  lastBattleResult.value = null;
  onboardingStep.value = null;
  tutorialDone.value = false;
  activeEvent.value = null;
  shopUnits.value = [];
  currentRunId.value = null;
  gameLoading.value = false;
  vi.clearAllMocks();

  vi.mocked(getCurrentRun).mockResolvedValue(ok(null));
  vi.mocked(startRun).mockResolvedValue(ok(defaultRun()));
  vi.mocked(apiSetupShop).mockResolvedValue(
    ok(
      makeShopState({
        shopUnits: [
          { unit: toBoardUnit(makeUnit({ id: "rat" })), frozen: false },
          { unit: toBoardUnit(makeUnit({ id: "rat" })), frozen: false },
          { unit: toBoardUnit(makeUnit({ id: "bat" })), frozen: false },
        ],
      }),
    ),
  );
});

describe("startGame", () => {
  it("sets phase to SHOP", async () => {
    await startGame("thief");
    expect(phase.value).toBe("SHOP");
  });

  it("sets origin", async () => {
    vi.mocked(startRun).mockResolvedValue(ok(defaultRun({ originId: "surgeon" })));
    await startGame("surgeon");
    expect(origin.value).toBe("surgeon");
  });

  it("sets blood to 10", async () => {
    await startGame("thief");
    expect(blood.value).toBe(10);
  });

  it("sets sanity to 5", async () => {
    await startGame("thief");
    expect(sanity.value).toBe(5);
  });

  it("resets trophy to 0", async () => {
    trophy.value = 5;
    await startGame("thief");
    expect(trophy.value).toBe(0);
  });

  it("sets round to 1", async () => {
    round.value = 10;
    await startGame("thief");
    expect(round.value).toBe(1);
  });

  it("clears board", async () => {
    await startGame("thief");
    expect(board.value).toEqual([null, null, null, null, null]);
  });

  it("sets onboardingStep to buy when tutorial not done", async () => {
    await startGame("thief");
    expect(onboardingStep.value).toBe("buy");
  });

  it("sets onboardingStep to null when tutorialDone is true", async () => {
    tutorialDone.value = true;
    await startGame("thief");
    expect(onboardingStep.value).toBeNull();
  });

  it("resets lastBattleResult", async () => {
    lastBattleResult.value = "WIN";
    await startGame("thief");
    expect(lastBattleResult.value).toBeNull();
  });

  it("first-time player gets shop from API", async () => {
    tutorialDone.value = false;
    await startGame("thief");
    const ids = shopUnits.value.filter(Boolean).map((s) => s!.unit.id);
    expect(ids).toEqual(["rat", "rat", "bat"]);
  });

  it("returning player gets shop from API", async () => {
    tutorialDone.value = true;
    vi.mocked(apiSetupShop).mockResolvedValue(
      ok(
        makeShopState({
          shopUnits: [
            { unit: toBoardUnit(makeUnit({ id: "hound" })), frozen: false },
            { unit: toBoardUnit(makeUnit({ id: "bat" })), frozen: false },
            { unit: toBoardUnit(makeUnit({ id: "rat" })), frozen: false },
          ],
        }),
      ),
    );
    await startGame("thief");
    expect(shopUnits.value.filter(Boolean).length).toBe(3);
  });

  it("no event on round 1 regardless of tutorial state", async () => {
    tutorialDone.value = false;
    await startGame("thief");
    expect(activeEvent.value).toBeNull();

    tutorialDone.value = true;
    vi.mocked(startRun).mockResolvedValue(ok(defaultRun()));
    vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState()));
    await startGame("thief");
    expect(activeEvent.value).toBeNull();
  });

  it("sets currentRunId from server response", async () => {
    await startGame("thief");
    expect(currentRunId.value).toBe("run-1");
  });

  it("sets currentRunId to null on server error fallback", async () => {
    vi.mocked(startRun).mockResolvedValue(
      err({ type: "API_FETCH_FAILED", status: 500, cause: null }),
    );
    await startGame("thief");
    expect(currentRunId.value).toBeNull();
  });

  it("calls startRun with originId", async () => {
    await startGame("surgeon");
    expect(startRun).toHaveBeenCalledWith("surgeon");
  });

  it("sets startGameError on server error without entering SHOP", async () => {
    vi.mocked(startRun).mockResolvedValue(
      err({ type: "API_FETCH_FAILED", status: 500, cause: null }),
    );
    await startGame("thief");
    expect(phase.value).toBe("TITLE");
    expect(startGameError.value).toEqual({ type: "API_FETCH_FAILED", status: 500, cause: null });
    expect(gameLoading.value).toBe(false);
  });

  it("resumes existing run when getCurrentRun returns active run", async () => {
    vi.mocked(getCurrentRun).mockResolvedValue(ok(defaultRun({ round: 3, sanity: 4, trophy: 2 })));
    vi.mocked(apiSetupShop).mockResolvedValue(
      ok(makeShopState({ round: 3, sanity: 4, trophy: 2 })),
    );
    await startGame("thief");
    expect(round.value).toBe(3);
    expect(sanity.value).toBe(4);
    expect(trophy.value).toBe(2);
    expect(startRun).not.toHaveBeenCalled();
  });

  it("prevents double startGame via gameLoading", async () => {
    gameLoading.value = true;
    await startGame("thief");
    expect(phase.value).not.toBe("SHOP");
  });
});
