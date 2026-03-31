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
  advanceRun: vi.fn(),
  retireRun: vi.fn(),
}));

vi.mock("../api/shop-client", () => ({
  setupShop: vi.fn(),
}));

import { startGame, resumeOrSelectOrigin, retireGame } from "./game-actions";
import { startRun, getCurrentRun, advanceRun, retireRun } from "../api/run-client";
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
  lastEnemyTeamType,
  currentRunId,
  onboardingStep,
  shopUnits,
  shopItems,
  selection,
  freeRoll,
  cultistUsed,
  rotRingUses,
  currentEnemyTeam,
  battleFrames,
  currentFrameIdx,
  battleResult,
  fastForward,
  activeEvent,
  gameLoading,
  battleBusy,
  battleLoading,
  battleLoadError,
  canUndo,
  shopLocked,
  shopActionError,
  startGameError,
  showHelpOverlay,
  showRetireConfirm,
  recoveryWarning,
  resetAllSignals,
} from "./game-store";
import { makeUnit } from "../../engine/test-helpers";
import type { CurrentRunState } from "../../shared/api-types";
import { makeShopState, toBoardUnit } from "./test-helpers";

function defaultRun(overrides: Partial<CurrentRunState> = {}): CurrentRunState {
  return {
    id: "run-1",
    round: 1,
    sanity: 5,
    trophy: 0,
    status: "active",
    originId: "thief",
    pendingBattleId: null,
    ...overrides,
  };
}

beforeEach(() => {
  resetAllSignals();
  tutorialDone.value = false;
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

  it("auto-advances when pendingBattleId exists", async () => {
    vi.mocked(getCurrentRun).mockResolvedValue(
      ok(defaultRun({ round: 2, sanity: 5, trophy: 1, pendingBattleId: "battle-1" })),
    );
    vi.mocked(advanceRun).mockResolvedValue(
      ok(defaultRun({ round: 3, sanity: 5, trophy: 2, pendingBattleId: null })),
    );
    vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState({ round: 3, trophy: 2 })));
    await startGame("thief");
    expect(advanceRun).toHaveBeenCalledWith("battle-1");
    expect(round.value).toBe(3);
    expect(trophy.value).toBe(2);
    expect(recoveryWarning.value).toBeNull();
  });

  it("falls back to current run state when advance fails on pending battle", async () => {
    vi.mocked(getCurrentRun).mockResolvedValue(
      ok(defaultRun({ round: 2, sanity: 5, trophy: 1, pendingBattleId: "battle-1" })),
    );
    vi.mocked(advanceRun).mockResolvedValue(
      err({ type: "API_FETCH_FAILED", status: 500, cause: null }),
    );
    vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState({ round: 2 })));
    await startGame("thief");
    expect(round.value).toBe(2);
    expect(phase.value).toBe("SHOP");
    expect(recoveryWarning.value).toBe("前回の戦闘結果を反映できませんでした");
  });

  it("recovers via re-fetch when advance returns 409", async () => {
    vi.mocked(getCurrentRun)
      .mockResolvedValueOnce(
        ok(defaultRun({ round: 2, sanity: 5, trophy: 1, pendingBattleId: "battle-1" })),
      )
      .mockResolvedValueOnce(
        ok(defaultRun({ round: 3, sanity: 5, trophy: 2, pendingBattleId: null })),
      );
    vi.mocked(advanceRun).mockResolvedValue(
      err({ type: "API_FETCH_FAILED", status: 409, cause: null }),
    );
    vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState({ round: 3, trophy: 2 })));
    await startGame("thief");
    expect(round.value).toBe(3);
    expect(trophy.value).toBe(2);
    expect(recoveryWarning.value).toBeNull();
  });

  it("falls back when 409 re-fetch also fails", async () => {
    vi.mocked(getCurrentRun)
      .mockResolvedValueOnce(
        ok(defaultRun({ round: 2, sanity: 5, trophy: 1, pendingBattleId: "battle-1" })),
      )
      .mockResolvedValueOnce(err({ type: "API_FETCH_FAILED", status: 500, cause: null }));
    vi.mocked(advanceRun).mockResolvedValue(
      err({ type: "API_FETCH_FAILED", status: 409, cause: null }),
    );
    vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState({ round: 2 })));
    await startGame("thief");
    expect(round.value).toBe(2);
    expect(recoveryWarning.value).toBe("前回の戦闘結果を反映できませんでした");
  });
});

describe("resumeOrSelectOrigin", () => {
  it("goes to SHOP when active run exists", async () => {
    vi.mocked(getCurrentRun).mockResolvedValue(ok(defaultRun({ round: 3, sanity: 4, trophy: 2 })));
    vi.mocked(apiSetupShop).mockResolvedValue(
      ok(makeShopState({ round: 3, sanity: 4, trophy: 2 })),
    );
    await resumeOrSelectOrigin();
    expect(phase.value).toBe("SHOP");
    expect(round.value).toBe(3);
    expect(sanity.value).toBe(4);
    expect(trophy.value).toBe(2);
  });

  it("goes to ORIGIN when no active run", async () => {
    vi.mocked(getCurrentRun).mockResolvedValue(ok(null));
    await resumeOrSelectOrigin();
    expect(phase.value).toBe("ORIGIN");
  });

  it("goes to ORIGIN and sets startGameError when getCurrentRun errors", async () => {
    vi.mocked(getCurrentRun).mockResolvedValue(
      err({ type: "API_FETCH_FAILED", status: 500, cause: null }),
    );
    await resumeOrSelectOrigin();
    expect(phase.value).toBe("ORIGIN");
    expect(startGameError.value).toEqual({ type: "API_FETCH_FAILED", status: 500, cause: null });
  });

  it("does not set startGameError when no run exists", async () => {
    vi.mocked(getCurrentRun).mockResolvedValue(ok(null));
    await resumeOrSelectOrigin();
    expect(phase.value).toBe("ORIGIN");
    expect(startGameError.value).toBeNull();
  });

  it("prevents double-fire via gameLoading", async () => {
    gameLoading.value = true;
    await resumeOrSelectOrigin();
    expect(phase.value).toBe("TITLE");
  });

  it("recovers pending battle before resuming", async () => {
    vi.mocked(getCurrentRun).mockResolvedValue(
      ok(defaultRun({ round: 2, sanity: 5, trophy: 1, pendingBattleId: "battle-1" })),
    );
    vi.mocked(advanceRun).mockResolvedValue(
      ok(defaultRun({ round: 3, sanity: 5, trophy: 2, pendingBattleId: null })),
    );
    vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState({ round: 3, trophy: 2 })));
    await resumeOrSelectOrigin();
    expect(advanceRun).toHaveBeenCalledWith("battle-1");
    expect(round.value).toBe(3);
    expect(trophy.value).toBe(2);
    expect(recoveryWarning.value).toBeNull();
  });

  it("sets recoveryWarning when pending battle recovery fails", async () => {
    vi.mocked(getCurrentRun).mockResolvedValue(
      ok(defaultRun({ round: 2, sanity: 5, trophy: 1, pendingBattleId: "battle-1" })),
    );
    vi.mocked(advanceRun).mockResolvedValue(
      err({ type: "API_FETCH_FAILED", status: 500, cause: null }),
    );
    vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState({ round: 2 })));
    await resumeOrSelectOrigin();
    expect(phase.value).toBe("SHOP");
    expect(round.value).toBe(2);
    expect(recoveryWarning.value).toBe("前回の戦闘結果を反映できませんでした");
  });

  it("recovers via re-fetch when advance returns 409", async () => {
    vi.mocked(getCurrentRun)
      .mockResolvedValueOnce(
        ok(defaultRun({ round: 2, sanity: 5, trophy: 1, pendingBattleId: "battle-1" })),
      )
      .mockResolvedValueOnce(
        ok(defaultRun({ round: 3, sanity: 5, trophy: 2, pendingBattleId: null })),
      );
    vi.mocked(advanceRun).mockResolvedValue(
      err({ type: "API_FETCH_FAILED", status: 409, cause: null }),
    );
    vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState({ round: 3, trophy: 2 })));
    await resumeOrSelectOrigin();
    expect(round.value).toBe(3);
    expect(trophy.value).toBe(2);
    expect(recoveryWarning.value).toBeNull();
  });

  it("falls back when 409 re-fetch also fails", async () => {
    vi.mocked(getCurrentRun)
      .mockResolvedValueOnce(
        ok(defaultRun({ round: 2, sanity: 5, trophy: 1, pendingBattleId: "battle-1" })),
      )
      .mockResolvedValueOnce(err({ type: "API_FETCH_FAILED", status: 500, cause: null }));
    vi.mocked(advanceRun).mockResolvedValue(
      err({ type: "API_FETCH_FAILED", status: 409, cause: null }),
    );
    vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState({ round: 2 })));
    await resumeOrSelectOrigin();
    expect(round.value).toBe(2);
    expect(recoveryWarning.value).toBe("前回の戦闘結果を反映できませんでした");
  });

  it("goes to ORIGIN when run has invalid originId", async () => {
    vi.mocked(getCurrentRun).mockResolvedValue(ok(defaultRun({ originId: null })));
    await resumeOrSelectOrigin();
    expect(phase.value).toBe("ORIGIN");
    expect(gameLoading.value).toBe(false);
  });

  it("resets gameLoading after completion", async () => {
    vi.mocked(getCurrentRun).mockResolvedValue(ok(null));
    await resumeOrSelectOrigin();
    expect(gameLoading.value).toBe(false);
  });
});

describe("retireGame", () => {
  beforeEach(() => {
    vi.mocked(retireRun).mockResolvedValue(ok(undefined));
    phase.value = "SHOP";
    currentRunId.value = "run-1";
    origin.value = "thief";
    round.value = 5;
    sanity.value = 3;
    trophy.value = 4;
  });

  it("resets phase to TITLE on success", async () => {
    await retireGame();
    expect(phase.value).toBe("TITLE");
  });

  it("resets all game state signals", async () => {
    shopUnits.value = [null];
    shopItems.value = [null];
    selection.value = { type: "BOARD_UNIT", index: 0 } as typeof selection.value;
    freeRoll.value = true;
    cultistUsed.value = true;
    rotRingUses.value = 3;
    battleBusy.value = true;
    battleLoading.value = true;
    battleLoadError.value = { type: "API_FETCH_FAILED", status: 500, cause: null };
    fastForward.value = true;
    currentEnemyTeam.value = {} as typeof currentEnemyTeam.value;
    battleFrames.value = [{}] as typeof battleFrames.value;
    currentFrameIdx.value = 5;
    battleResult.value = "WIN";
    lastEnemyTeamType.value = "同業者";
    canUndo.value = true;
    startGameError.value = { type: "API_FETCH_FAILED", status: 500, cause: null };
    showHelpOverlay.value = true;
    showRetireConfirm.value = true;
    activeEvent.value = {} as typeof activeEvent.value;

    await retireGame();

    expect(phase.value).toBe("TITLE");
    expect(currentRunId.value).toBeNull();
    expect(origin.value).toBeNull();
    expect(round.value).toBe(1);
    expect(sanity.value).toBe(5);
    expect(trophy.value).toBe(0);
    expect(blood.value).toBe(10);
    expect(board.value).toEqual([null, null, null, null, null]);
    expect(shopUnits.value).toEqual([]);
    expect(shopItems.value).toEqual([]);
    expect(selection.value).toBeNull();
    expect(freeRoll.value).toBe(false);
    expect(cultistUsed.value).toBe(false);
    expect(rotRingUses.value).toBe(0);
    expect(battleBusy.value).toBe(false);
    expect(battleLoading.value).toBe(false);
    expect(battleLoadError.value).toBeNull();
    expect(fastForward.value).toBe(false);
    expect(currentEnemyTeam.value).toBeNull();
    expect(battleFrames.value).toEqual([]);
    expect(currentFrameIdx.value).toBe(0);
    expect(battleResult.value).toBeNull();
    expect(lastEnemyTeamType.value).toBeNull();
    expect(shopLocked.value).toBe(false);
    expect(canUndo.value).toBe(false);
    expect(shopActionError.value).toBeNull();
    expect(startGameError.value).toBeNull();
    expect(activeEvent.value).toBeNull();
    expect(showHelpOverlay.value).toBe(false);
    expect(showRetireConfirm.value).toBe(false);
    expect(recoveryWarning.value).toBeNull();
    expect(gameLoading.value).toBe(false);
  });

  it("resets when API fails but server confirms retire succeeded", async () => {
    vi.mocked(retireRun).mockResolvedValue(
      err({ type: "API_FETCH_FAILED", status: 500, cause: null }),
    );
    vi.mocked(getCurrentRun).mockResolvedValue(ok(null));
    await retireGame();
    expect(phase.value).toBe("TITLE");
    expect(currentRunId.value).toBeNull();
    expect(shopActionError.value).toBeNull();
  });

  it("sets shopActionError when retire truly failed", async () => {
    vi.mocked(retireRun).mockResolvedValue(
      err({ type: "API_FETCH_FAILED", status: 500, cause: null }),
    );
    vi.mocked(getCurrentRun).mockResolvedValue(ok(defaultRun()));
    await retireGame();
    expect(phase.value).toBe("SHOP");
    expect(shopActionError.value).toEqual({ type: "API_FETCH_FAILED", status: 500, cause: null });
  });

  it("sets shopActionError when verification also fails", async () => {
    vi.mocked(retireRun).mockResolvedValue(
      err({ type: "API_FETCH_FAILED", status: 500, cause: null }),
    );
    vi.mocked(getCurrentRun).mockResolvedValue(
      err({ type: "API_FETCH_FAILED", status: 500, cause: null }),
    );
    await retireGame();
    expect(phase.value).toBe("SHOP");
    expect(shopActionError.value).toEqual({ type: "API_FETCH_FAILED", status: 500, cause: null });
  });

  it("skips when already retiring", async () => {
    // 1回目を開始（resolveされていないPromiseでブロック）
    let resolve!: (v: ReturnType<typeof retireRun> extends Promise<infer R> ? R : never) => void;
    vi.mocked(retireRun).mockReturnValue(new Promise((r) => (resolve = r)));
    const first = retireGame();
    // 2回目は即座にスキップされる
    await retireGame();
    expect(retireRun).toHaveBeenCalledTimes(1);
    resolve(ok(undefined));
    await first;
  });

  it("clears shopActionError at start", async () => {
    shopActionError.value = { type: "API_FETCH_FAILED", status: 500, cause: null };
    await retireGame();
    expect(shopActionError.value).toBeNull();
  });
});
