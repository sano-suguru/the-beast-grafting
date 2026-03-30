vi.mock("../engine/audio", () => ({
  initAudio: vi.fn(),
  playSE: vi.fn(),
}));

vi.mock("../api/shop-client", () => ({
  readyForBattle: vi.fn(),
  setupShop: vi.fn(),
}));

vi.mock("../api/pvp-client", () => ({
  requestBattle: vi.fn(),
}));

vi.mock("../api/run-client", () => ({
  advanceRun: vi.fn(),
}));

import { startPreBattle, startActualBattle, concludeBattle, retryBattle } from "./battle-actions";
import * as lore from "./lore";
import { readyForBattle as apiReadyForBattle, setupShop as apiSetupShop } from "../api/shop-client";
import { requestBattle } from "../api/pvp-client";
import { advanceRun } from "../api/run-client";
import { ok, err } from "../../shared/errors";
import type { InfraError } from "../../shared/errors";
import type { ShopStateResponse, RunState } from "../../shared/api-types";
import {
  phase,
  round,
  sanity,
  trophy,
  board,
  selection,
  currentEnemyTeam,
  battleFrames,
  currentFrameIdx,
  battleResult,
  fastForward,
  lastBattleResult,
  currentRunId,
  lastBattleId,
  battleError,
  battleBusy,
  battleLoading,
  battleLoadError,
  onboardingStep,
  origin,
  blood,
  freeRoll,
  cultistUsed,
  shopUnits,
  shopItems,
  shopLocked,
  canUndo,
  rotRingUses,
} from "./game-store";
import { makeUnit } from "../../engine/test-helpers";
import { makeShopState as _makeShopState, toBoardUnit } from "./test-helpers";

function makeShopState(overrides: Partial<ShopStateResponse> = {}): ShopStateResponse {
  return _makeShopState({
    board: [toBoardUnit(makeUnit({ atk: 10, hp: 10 })), null, null, null, null],
    ...overrides,
  });
}

function defaultBattleResponse() {
  return {
    battleId: "test-battle-id",
    frames: [
      {
        pBoard: [makeUnit()],
        eBoard: [],
        log: { id: "1", type: "result" as const, text: "勝利", icon: "trophy" as const },
        actions: {},
      },
    ],
    result: "WIN" as const,
    opponent: {
      playerId: "opponent-1",
      teamName: "テスト敵",
      teamType: "同業者" as const,
      units: [],
    },
    seed: 42,
  };
}

function defaultRunState(overrides: Partial<RunState> = {}): RunState {
  const base: RunState = {
    id: "run-1",
    round: 2,
    sanity: 5,
    trophy: 1,
    status: "active",
    originId: null,
  };
  return { ...base, ...overrides };
}

beforeEach(() => {
  phase.value = "SHOP";
  round.value = 1;
  sanity.value = 5;
  trophy.value = 0;
  board.value = [makeUnit({ atk: 10, hp: 10 }), null, null, null, null];
  selection.value = null;
  currentEnemyTeam.value = null;
  battleFrames.value = [];
  currentFrameIdx.value = 0;
  battleResult.value = null;
  fastForward.value = false;
  lastBattleResult.value = null;
  currentRunId.value = "test-run-id";
  lastBattleId.value = null;
  battleError.value = null;
  battleBusy.value = false;
  battleLoading.value = false;
  battleLoadError.value = null;
  onboardingStep.value = null;
  origin.value = null;
  blood.value = 10;
  freeRoll.value = false;
  cultistUsed.value = false;
  shopUnits.value = [];
  shopItems.value = [];
  shopLocked.value = false;
  canUndo.value = false;
  rotRingUses.value = 0;
  vi.clearAllMocks();

  vi.mocked(apiReadyForBattle).mockResolvedValue(ok(makeShopState()));
  vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState()));
  vi.mocked(requestBattle).mockResolvedValue(ok(defaultBattleResponse()));
  vi.mocked(advanceRun).mockResolvedValue(ok(defaultRunState()));
});

describe("startPreBattle", () => {
  it("transitions to PRE_BATTLE after readyForBattle, then loads battle in background", async () => {
    startPreBattle();
    await vi.waitFor(() => expect(phase.value).toBe("PRE_BATTLE"));
    expect(apiReadyForBattle).toHaveBeenCalledWith("test-run-id");
    await vi.waitFor(() => expect(battleLoading.value).toBe(false));
    expect(requestBattle).toHaveBeenCalledWith("test-run-id", 1);
  });

  it("sets currentEnemyTeam after background battle load", async () => {
    startPreBattle();
    await vi.waitFor(() => expect(currentEnemyTeam.value).not.toBeNull());
    expect(currentEnemyTeam.value!.teamName).toBe("テスト敵");
  });

  it("stores battle data for later playback", async () => {
    startPreBattle();
    await vi.waitFor(() => expect(battleFrames.value.length).toBeGreaterThan(0));
    expect(battleResult.value).toBe("WIN");
    expect(lastBattleId.value).toBe("test-battle-id");
  });

  it("does nothing with empty board", () => {
    board.value = [null, null, null, null, null];
    startPreBattle();
    expect(phase.value).toBe("SHOP");
    expect(apiReadyForBattle).not.toHaveBeenCalled();
  });

  it("stays on SHOP when readyForBattle fails", async () => {
    const infraErr: InfraError = { type: "API_FETCH_FAILED", status: 500, cause: null };
    vi.mocked(apiReadyForBattle).mockResolvedValue(err(infraErr));
    startPreBattle();
    await vi.waitFor(() => expect(shopLocked.value).toBe(false));
    expect(phase.value).toBe("SHOP");
    expect(requestBattle).not.toHaveBeenCalled();
  });

  it("goes to PRE_BATTLE but sets battleLoadError when requestBattle fails", async () => {
    const infraErr: InfraError = { type: "API_FETCH_FAILED", status: 500, cause: null };
    vi.mocked(requestBattle).mockResolvedValue(err(infraErr));
    startPreBattle();
    await vi.waitFor(() => expect(phase.value).toBe("PRE_BATTLE"));
    await vi.waitFor(() => expect(battleLoading.value).toBe(false));
    expect(battleLoadError.value).toEqual(infraErr);
  });

  it("clears onboarding step when battle", async () => {
    onboardingStep.value = "battle";
    startPreBattle();
    await vi.waitFor(() => expect(phase.value).toBe("PRE_BATTLE"));
    expect(onboardingStep.value).toBeNull();
  });

  it("does nothing when shopLocked", () => {
    shopLocked.value = true;
    startPreBattle();
    expect(apiReadyForBattle).not.toHaveBeenCalled();
  });

  it("does nothing without runId", () => {
    currentRunId.value = null;
    startPreBattle();
    expect(apiReadyForBattle).not.toHaveBeenCalled();
  });
});

describe("retryBattle", () => {
  it("re-fetches battle data", async () => {
    const infraErr: InfraError = { type: "API_FETCH_FAILED", status: 500, cause: null };
    vi.mocked(requestBattle).mockResolvedValueOnce(err(infraErr));
    startPreBattle();
    await vi.waitFor(() => expect(battleLoadError.value).not.toBeNull());

    vi.mocked(requestBattle).mockResolvedValueOnce(ok(defaultBattleResponse()));
    retryBattle();
    await vi.waitFor(() => expect(battleLoading.value).toBe(false));
    expect(battleLoadError.value).toBeNull();
    expect(battleFrames.value.length).toBeGreaterThan(0);
  });

  it("does nothing when already loading", async () => {
    startPreBattle();
    await vi.waitFor(() => expect(phase.value).toBe("PRE_BATTLE"));
    battleLoading.value = true;
    retryBattle();
    expect(requestBattle).toHaveBeenCalledTimes(1);
  });
});

describe("startActualBattle", () => {
  async function setupPreBattle() {
    startPreBattle();
    await vi.waitFor(() => expect(battleLoading.value).toBe(false));
    expect(phase.value).toBe("PRE_BATTLE");
  }

  it("transitions to BATTLE phase with pre-loaded data", async () => {
    await setupPreBattle();
    startActualBattle();
    expect(phase.value).toBe("BATTLE");
    expect(currentFrameIdx.value).toBe(0);
    expect(fastForward.value).toBe(false);
  });

  it("does nothing when phase is not PRE_BATTLE", () => {
    phase.value = "SHOP";
    startActualBattle();
    expect(phase.value).toBe("SHOP");
  });

  it("does nothing when battleLoading is true", async () => {
    await setupPreBattle();
    battleLoading.value = true;
    startActualBattle();
    expect(phase.value).toBe("PRE_BATTLE");
  });

  it("does nothing when battleLoadError is set", async () => {
    await setupPreBattle();
    battleLoadError.value = { type: "API_FETCH_FAILED", status: 500, cause: null };
    startActualBattle();
    expect(phase.value).toBe("PRE_BATTLE");
  });

  it("does nothing when battleFrames is empty", () => {
    phase.value = "PRE_BATTLE";
    battleFrames.value = [];
    startActualBattle();
    expect(phase.value).toBe("PRE_BATTLE");
  });
});

describe("concludeBattle", () => {
  it("increments trophy on win from server", async () => {
    battleResult.value = "WIN";
    trophy.value = 3;
    lastBattleId.value = "b-1";
    vi.mocked(advanceRun).mockResolvedValue(ok(defaultRunState({ trophy: 4 })));
    vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState({ trophy: 4 })));
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(trophy.value).toBe(4);
  });

  it("calls advanceRun with battleId", async () => {
    battleResult.value = "WIN";
    lastBattleId.value = "b-1";
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(advanceRun).toHaveBeenCalledWith("b-1");
  });

  it("advances round from server response", async () => {
    battleResult.value = "WIN";
    round.value = 2;
    lastBattleId.value = "b-1";
    vi.mocked(advanceRun).mockResolvedValue(ok(defaultRunState({ round: 3, trophy: 1 })));
    vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState({ round: 3, trophy: 1 })));
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(round.value).toBe(3);
    expect(phase.value).toBe("SHOP");
  });

  it("decrements sanity on loss from server", async () => {
    battleResult.value = "LOSE";
    sanity.value = 3;
    lastBattleId.value = "b-1";
    vi.mocked(advanceRun).mockResolvedValue(ok(defaultRunState({ sanity: 2, trophy: 0 })));
    vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState({ sanity: 2, trophy: 0 })));
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(sanity.value).toBe(2);
  });

  it("game over when server returns lost status", async () => {
    battleResult.value = "LOSE";
    sanity.value = 1;
    lastBattleId.value = "b-1";
    vi.mocked(advanceRun).mockResolvedValue(
      ok(defaultRunState({ sanity: 0, trophy: 0, status: "lost" })),
    );
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(sanity.value).toBe(0);
    expect(phase.value).toBe("RESULT");
  });

  it("game clear when server returns won status", async () => {
    battleResult.value = "WIN";
    trophy.value = 9;
    lastBattleId.value = "b-1";
    vi.mocked(advanceRun).mockResolvedValue(
      ok(defaultRunState({ sanity: 5, trophy: 10, status: "won" })),
    );
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(trophy.value).toBe(10);
    expect(phase.value).toBe("RESULT");
  });

  it("draw advances round without changing sanity or trophy", async () => {
    battleResult.value = "DRAW";
    sanity.value = 5;
    trophy.value = 3;
    round.value = 2;
    lastBattleId.value = "b-1";
    vi.mocked(advanceRun).mockResolvedValue(
      ok(defaultRunState({ round: 3, sanity: 5, trophy: 3 })),
    );
    vi.mocked(apiSetupShop).mockResolvedValue(
      ok(makeShopState({ round: 3, sanity: 5, trophy: 3 })),
    );
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(sanity.value).toBe(5);
    expect(trophy.value).toBe(3);
    expect(round.value).toBe(3);
    expect(phase.value).toBe("SHOP");
  });

  it("calls markMastered for level 3 non-church units on game clear", async () => {
    const spy = vi.spyOn(lore, "markMastered");
    battleResult.value = "WIN";
    trophy.value = 9;
    lastBattleId.value = "b-1";
    vi.mocked(advanceRun).mockResolvedValue(
      ok(defaultRunState({ sanity: 5, trophy: 10, status: "won" })),
    );
    board.value = [
      makeUnit({ id: "beast", level: 3, isChurch: false }),
      makeUnit({ id: "rat", level: 1, isChurch: false }),
      makeUnit({ id: "church_beast", level: 3, isChurch: true }),
      null,
      null,
    ];
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(spy).toHaveBeenCalledWith(["beast"]);
    spy.mockRestore();
  });

  it("does nothing when battleBusy is true", () => {
    battleBusy.value = true;
    phase.value = "BATTLE";
    battleResult.value = "WIN";
    concludeBattle();
    expect(phase.value).toBe("BATTLE");
  });

  it("falls back to local round advance on advanceRun failure", async () => {
    battleResult.value = "WIN";
    trophy.value = 3;
    round.value = 2;
    lastBattleId.value = "b-1";
    vi.mocked(advanceRun).mockResolvedValue(
      err({ type: "API_FETCH_FAILED", status: 500, cause: null }),
    );
    vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState({ round: 3, trophy: 4 })));
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(round.value).toBe(3);
    expect(phase.value).toBe("SHOP");
  });

  it("advances locally when no battleId", async () => {
    battleResult.value = "WIN";
    trophy.value = 3;
    round.value = 2;
    lastBattleId.value = null;
    vi.mocked(apiSetupShop).mockResolvedValue(ok(makeShopState({ round: 3, trophy: 4 })));
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(trophy.value).toBe(4);
    expect(round.value).toBe(3);
    expect(phase.value).toBe("SHOP");
  });
});
