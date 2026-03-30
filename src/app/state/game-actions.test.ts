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

import { startGame } from "./game-actions";
import { apiFetch } from "../api/fetch";
import { createRoutedApiFetch } from "../api/test-helpers";
import { tutorialDone } from "./tutorial";
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
} from "./game-store";

const mockApiFetch = vi.mocked(apiFetch);

function defaultRunResponse(overrides: Record<string, unknown> = {}) {
  return {
    run: {
      id: "run-1",
      round: 1,
      sanity: 5,
      trophy: 0,
      status: "active",
      originId: "thief",
      ...overrides,
    },
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
  mockApiFetch.mockReset();
  mockApiFetch.mockImplementation(
    createRoutedApiFetch({
      "/api/run/start": defaultRunResponse(),
    }),
  );
});

describe("startGame", () => {
  it("sets phase to SHOP", async () => {
    await startGame("thief");
    expect(phase.value).toBe("SHOP");
  });

  it("sets origin", async () => {
    await startGame("surgeon");
    expect(origin.value).toBe("surgeon");
  });

  it("sets blood to 10", async () => {
    await startGame("thief");
    expect(blood.value).toBe(10);
  });

  it("sets sanity to 5 for most origins", async () => {
    await startGame("thief");
    expect(sanity.value).toBe(5);
  });

  it("sets sanity to 5 for inquisitor", async () => {
    mockApiFetch.mockImplementation(
      createRoutedApiFetch({
        "/api/run/start": defaultRunResponse({ originId: "inquisitor" }),
      }),
    );
    await startGame("inquisitor");
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

  it("first-time player gets fixed shop (rat/rat/bat)", async () => {
    tutorialDone.value = false;
    await startGame("thief");
    const ids = shopUnits.value.filter(Boolean).map((s) => s!.unit.id);
    expect(ids).toEqual(["rat", "rat", "bat"]);
  });

  it("returning player gets random shop", async () => {
    tutorialDone.value = true;
    await startGame("thief");
    expect(shopUnits.value.filter(Boolean).length).toBe(3);
  });

  it("no event on round 1 regardless of tutorial state", async () => {
    tutorialDone.value = false;
    await startGame("thief");
    expect(activeEvent.value).toBeNull();

    tutorialDone.value = true;
    await startGame("thief");
    expect(activeEvent.value).toBeNull();
  });

  it("sets currentRunId from server response", async () => {
    await startGame("thief");
    expect(currentRunId.value).toBe("run-1");
  });

  it("sets currentRunId to null on server error fallback", async () => {
    const { err } = await import("../../shared/errors");
    mockApiFetch.mockResolvedValue(err({ type: "API_FETCH_FAILED", status: 500, cause: null }));
    await startGame("thief");
    expect(currentRunId.value).toBeNull();
  });

  it("calls startRun with originId", async () => {
    await startGame("surgeon");
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/run/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ originId: "surgeon" }),
      }),
    );
  });

  it("falls back to local on server error", async () => {
    const { err } = await import("../../shared/errors");
    mockApiFetch.mockResolvedValue(err({ type: "API_FETCH_FAILED", status: 500, cause: null }));
    await startGame("thief");
    expect(phase.value).toBe("SHOP");
    expect(sanity.value).toBe(5);
  });

  it("resumes existing run on 409 conflict", async () => {
    const { ok, err } = await import("../../shared/errors");
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/run/start")) {
        return err({ type: "API_FETCH_FAILED", status: 409, cause: null });
      }
      if (path.startsWith("/api/run/current")) {
        return ok(defaultRunResponse({ round: 3, sanity: 4, trophy: 2 }));
      }
      return err({ type: "API_FETCH_FAILED", status: 404, cause: null });
    });
    await startGame("thief");
    expect(round.value).toBe(3);
    expect(sanity.value).toBe(4);
    expect(trophy.value).toBe(2);
  });

  it("prevents double startGame via gameLoading", async () => {
    gameLoading.value = true;
    await startGame("thief");
    expect(phase.value).not.toBe("SHOP");
  });
});
