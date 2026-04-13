import {
  startPreBattle,
  startActualBattle,
  concludeBattle,
  retryBattle,
  proceedFromBattleResult,
} from "./battle-actions";
import type { ShopStateResponse, RunState, BattleResponse } from "../../shared/api-types";
import {
  phase,
  night,
  life,
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
  battleConcludeData,
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
import { makeUnit, makeSnapshot } from "../../engine/test-helpers";
import { makeShopState as _makeShopState, toBoardUnit, stubFetch } from "./test-helpers";
import type { RouteHandler } from "./test-helpers";

function makeShopState(overrides: Partial<ShopStateResponse> = {}): ShopStateResponse {
  return _makeShopState({
    board: [toBoardUnit(makeUnit({ baseAtk: 10, baseHp: 10 })), null, null, null, null],
    ...overrides,
  });
}

function defaultBattleResponse(): BattleResponse {
  return {
    battleId: "test-battle-id",
    frames: [
      {
        pBoard: [makeSnapshot()],
        eBoard: [],
        log: { id: "1", type: "result" as const, segments: ["勝利"], icon: "trophy" as const },
        actions: {},
      },
    ],
    result: "WIN",
    opponent: {
      playerId: "opponent-1",
      teamName: "テスト敵",
      teamType: "同業者",
      units: [],
      night: 3,
      life: 4,
      trophy: 2,
    },
    seed: 42,
  };
}

function defaultRunState(overrides: Partial<RunState> = {}): RunState {
  return {
    id: "run-1",
    night: 2,
    life: 5,
    trophy: 1,
    status: "active",
    originId: null,
    ...overrides,
  };
}

function battleRoutes(opts?: {
  shopState?: ShopStateResponse;
  battleResponse?: BattleResponse;
  runState?: RunState;
}): RouteHandler {
  const shop = opts?.shopState ?? makeShopState();
  const battle = opts?.battleResponse ?? defaultBattleResponse();
  const run = opts?.runState ?? defaultRunState();
  return (url) => {
    if (url.startsWith("/api/shop/")) return { shop };
    if (url === "/api/pvp/battle") return battle;
    if (url === "/api/run/advance") return { run };
    if (url === "/api/lore") return { lore: {} };
    return undefined;
  };
}

function stubError() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "fail" }), { status: 500 })),
  );
}

beforeEach(() => {
  phase.value = "SHOP";
  night.value = 1;
  life.value = 5;
  trophy.value = 0;
  board.value = [makeUnit({ baseAtk: 10, baseHp: 10 }), null, null, null, null];
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
  battleConcludeData.value = null;
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
  vi.restoreAllMocks();

  stubFetch(battleRoutes());
});

describe("startPreBattle", () => {
  it("transitions to PRE_BATTLE after readyForBattle, then loads battle in background", async () => {
    const spy = stubFetch(battleRoutes());
    startPreBattle();
    await vi.waitFor(() => expect(phase.value).toBe("PRE_BATTLE"));
    expect(spy).toHaveBeenCalledWith("/api/shop/ready", expect.anything());
    await vi.waitFor(() => expect(battleLoading.value).toBe(false));
    expect(spy).toHaveBeenCalledWith("/api/pvp/battle", expect.anything());
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
    const spy = stubFetch(battleRoutes());
    board.value = [null, null, null, null, null];
    startPreBattle();
    expect(phase.value).toBe("SHOP");
    expect(spy).not.toHaveBeenCalled();
  });

  it("stays on SHOP when readyForBattle fails", async () => {
    stubError();
    startPreBattle();
    await vi.waitFor(() => expect(shopLocked.value).toBe(false));
    expect(phase.value).toBe("SHOP");
  });

  it("goes to PRE_BATTLE but sets battleLoadError when requestBattle fails", async () => {
    stubFetch((url) => {
      if (url.startsWith("/api/shop/")) return { shop: makeShopState() };
      return undefined;
    });
    startPreBattle();
    await vi.waitFor(() => expect(phase.value).toBe("PRE_BATTLE"));
    await vi.waitFor(() => expect(battleLoading.value).toBe(false));
    expect(battleLoadError.value).not.toBeNull();
  });

  it("clears onboarding step when battle", async () => {
    onboardingStep.value = "battle";
    startPreBattle();
    await vi.waitFor(() => expect(phase.value).toBe("PRE_BATTLE"));
    expect(onboardingStep.value).toBeNull();
  });

  it("does nothing when shopLocked", () => {
    const spy = stubFetch(battleRoutes());
    shopLocked.value = true;
    startPreBattle();
    expect(spy).not.toHaveBeenCalled();
  });

  it("does nothing without runId", () => {
    const spy = stubFetch(battleRoutes());
    currentRunId.value = null;
    startPreBattle();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("retryBattle", () => {
  it("re-fetches battle data", async () => {
    // First attempt fails
    stubFetch((url) => {
      if (url.startsWith("/api/shop/")) return { shop: makeShopState() };
      return undefined;
    });
    startPreBattle();
    await vi.waitFor(() => expect(battleLoadError.value).not.toBeNull());

    // Retry succeeds
    stubFetch(battleRoutes());
    retryBattle();
    await vi.waitFor(() => expect(battleLoading.value).toBe(false));
    expect(battleLoadError.value).toBeNull();
    expect(battleFrames.value.length).toBeGreaterThan(0);
  });

  it("does nothing when already loading", async () => {
    startPreBattle();
    await vi.waitFor(() => expect(phase.value).toBe("PRE_BATTLE"));
    battleLoading.value = true;
    const spy = stubFetch(battleRoutes());
    retryBattle();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("startActualBattle", () => {
  async function setupPreBattle() {
    startPreBattle();
    await vi.waitFor(() => expect(phase.value).toBe("PRE_BATTLE"));
    await vi.waitFor(() => expect(battleLoading.value).toBe(false));
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
    stubFetch(
      battleRoutes({
        runState: defaultRunState({ trophy: 4 }),
        shopState: makeShopState({ trophy: 4 }),
      }),
    );
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(trophy.value).toBe(4);
  });

  it("sends battleId to advance endpoint", async () => {
    battleResult.value = "WIN";
    lastBattleId.value = "b-1";
    const spy = stubFetch(battleRoutes());
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    const advanceCall = spy.mock.calls.find((c) => c[0] === "/api/run/advance");
    expect(advanceCall).toBeDefined();
    const body = JSON.parse(advanceCall![1]!.body as string);
    expect(body.battleId).toBe("b-1");
  });

  it("advances night from server response", async () => {
    battleResult.value = "WIN";
    night.value = 2;
    lastBattleId.value = "b-1";
    stubFetch(
      battleRoutes({
        runState: defaultRunState({ night: 3, trophy: 1 }),
        shopState: makeShopState({ night: 3, trophy: 1 }),
      }),
    );
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(night.value).toBe(3);
    expect(phase.value).toBe("BATTLE_RESULT");
  });

  it("decrements life on loss from server", async () => {
    battleResult.value = "LOSE";
    life.value = 3;
    lastBattleId.value = "b-1";
    stubFetch(
      battleRoutes({
        runState: defaultRunState({ life: 2, trophy: 0 }),
        shopState: makeShopState({ life: 2, trophy: 0 }),
      }),
    );
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(life.value).toBe(2);
  });

  it("game over when server returns lost status", async () => {
    battleResult.value = "LOSE";
    life.value = 1;
    lastBattleId.value = "b-1";
    stubFetch(battleRoutes({ runState: defaultRunState({ life: 0, trophy: 0, status: "lost" }) }));
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(life.value).toBe(0);
    expect(phase.value).toBe("BATTLE_RESULT");
  });

  it("game clear when server returns won status", async () => {
    battleResult.value = "WIN";
    trophy.value = 9;
    lastBattleId.value = "b-1";
    stubFetch(battleRoutes({ runState: defaultRunState({ life: 5, trophy: 10, status: "won" }) }));
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(trophy.value).toBe(10);
    expect(phase.value).toBe("BATTLE_RESULT");
  });

  it("draw advances night without changing life or trophy", async () => {
    battleResult.value = "DRAW";
    life.value = 5;
    trophy.value = 3;
    night.value = 2;
    lastBattleId.value = "b-1";
    stubFetch(
      battleRoutes({
        runState: defaultRunState({ night: 3, life: 5, trophy: 3 }),
        shopState: makeShopState({ night: 3, life: 5, trophy: 3 }),
      }),
    );
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(life.value).toBe(5);
    expect(trophy.value).toBe(3);
    expect(night.value).toBe(3);
    expect(phase.value).toBe("BATTLE_RESULT");
  });

  it("does nothing when battleBusy is true", () => {
    battleBusy.value = true;
    phase.value = "BATTLE";
    battleResult.value = "WIN";
    concludeBattle();
    expect(phase.value).toBe("BATTLE");
  });

  it("falls back to local night advance on advanceRun failure", async () => {
    battleResult.value = "WIN";
    trophy.value = 3;
    night.value = 2;
    lastBattleId.value = "b-1";
    stubFetch((url) => {
      if (url.startsWith("/api/shop/")) return { shop: makeShopState({ night: 3, trophy: 4 }) };
      if (url === "/api/lore") return { lore: {} };
      return undefined;
    });
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(night.value).toBe(3);
    expect(phase.value).toBe("BATTLE_RESULT");
  });

  it("advances locally when no battleId", async () => {
    battleResult.value = "WIN";
    trophy.value = 3;
    night.value = 2;
    lastBattleId.value = null;
    stubFetch(battleRoutes({ shopState: makeShopState({ night: 3, trophy: 4 }) }));
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(trophy.value).toBe(4);
    expect(night.value).toBe(3);
    expect(phase.value).toBe("BATTLE_RESULT");
  });
});

describe("proceedFromBattleResult", () => {
  it("transitions to RESULT and clears battleConcludeData when gameEnded", () => {
    battleConcludeData.value = {
      lifeDelta: -1,
      trophyDelta: 0,
      gameEnded: true,
      unlockedTier: null,
    };
    proceedFromBattleResult();
    expect(phase.value).toBe("RESULT");
    expect(battleConcludeData.value).toBeNull();
  });

  it("transitions to SHOP and calls setupNight when game not ended", async () => {
    const spy = stubFetch(battleRoutes());
    battleConcludeData.value = {
      lifeDelta: 0,
      trophyDelta: 1,
      gameEnded: false,
      unlockedTier: null,
    };
    proceedFromBattleResult();
    expect(phase.value).toBe("SHOP");
    expect(battleConcludeData.value).toBeNull();
    await vi.waitFor(() => expect(spy).toHaveBeenCalledWith("/api/shop/setup", expect.anything()));
  });

  it("does nothing when battleConcludeData is null", () => {
    phase.value = "BATTLE_RESULT";
    battleConcludeData.value = null;
    proceedFromBattleResult();
    expect(phase.value).toBe("BATTLE_RESULT");
  });

  it("does not call setupNight when no runId", () => {
    const spy = stubFetch(battleRoutes());
    currentRunId.value = null;
    battleConcludeData.value = {
      lifeDelta: 0,
      trophyDelta: 1,
      gameEnded: false,
      unlockedTier: null,
    };
    proceedFromBattleResult();
    expect(phase.value).toBe("SHOP");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("tier unlock detection", () => {
  it("sets unlockedTier when night advances to tier boundary", async () => {
    battleResult.value = "WIN";
    night.value = 2;
    lastBattleId.value = "b-1";
    stubFetch(
      battleRoutes({
        runState: defaultRunState({ night: 3, trophy: 1 }),
        shopState: makeShopState({ night: 3, trophy: 1 }),
      }),
    );
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(battleConcludeData.value?.unlockedTier).toBe(2);
  });

  it("sets unlockedTier null when tier does not change", async () => {
    battleResult.value = "WIN";
    night.value = 1;
    lastBattleId.value = "b-1";
    stubFetch(
      battleRoutes({
        runState: defaultRunState({ night: 2, trophy: 1 }),
        shopState: makeShopState({ night: 2, trophy: 1 }),
      }),
    );
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(battleConcludeData.value?.unlockedTier).toBeNull();
  });

  it("sets unlockedTier null when game ended", async () => {
    battleResult.value = "LOSE";
    night.value = 2;
    life.value = 1;
    lastBattleId.value = "b-1";
    stubFetch(battleRoutes({ runState: defaultRunState({ night: 3, life: 0, status: "lost" }) }));
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(battleConcludeData.value?.unlockedTier).toBeNull();
  });

  it("sets unlockedTier in local fallback path", async () => {
    battleResult.value = "WIN";
    night.value = 2;
    trophy.value = 0;
    lastBattleId.value = null;
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(battleConcludeData.value?.unlockedTier).toBe(2);
  });
});
