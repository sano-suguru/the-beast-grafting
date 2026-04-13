import { startGame, resumeOrSelectOrigin, retireGame } from "./game-actions";
import { tutorialDone } from "./tutorial";
import {
  phase,
  origin,
  blood,
  life,
  trophy,
  night,
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
  resourceError,
  flashResourceError,
  resetAllSignals,
} from "./game-store";
import { makeUnit } from "../../engine/test-helpers";
import type { CurrentRunState } from "../../shared/api-types";
import {
  makeShopState,
  toBoardUnit,
  stubFetch,
  stubSessionRecovery,
  httpError,
  toUrlString,
  type RouteHandler,
} from "./test-helpers";

function defaultRun(overrides: Partial<CurrentRunState> = {}): CurrentRunState {
  return {
    id: "run-1",
    night: 1,
    life: 5,
    trophy: 0,
    status: "active",
    originId: "thief",
    pendingBattleId: null,
    ...overrides,
  };
}

const defaultShopUnits = [
  { unit: toBoardUnit(makeUnit({ id: "rat" })), frozen: false, eventSourced: false },
  { unit: toBoardUnit(makeUnit({ id: "rat" })), frozen: false, eventSourced: false },
  { unit: toBoardUnit(makeUnit({ id: "bat" })), frozen: false, eventSourced: false },
] as const;

function resolveRunOrError(value: CurrentRunState | number | undefined, fallback: CurrentRunState) {
  if (typeof value === "number") return httpError(value);
  return { run: value ?? fallback };
}

interface GameRouteOpts {
  currentRun?: CurrentRunState | null;
  startRun?: CurrentRunState;
  advanceRun?: CurrentRunState | number;
  shopState?: Parameters<typeof makeShopState>[0];
  retireRun?: number;
}

function gameRoutes(opts?: GameRouteOpts): RouteHandler {
  const routes: Record<string, () => unknown> = {
    "/api/run/current": () => ({ run: opts?.currentRun ?? null }),
    "/api/run/start": () => resolveRunOrError(opts?.startRun, defaultRun()),
    "/api/run/advance": () => resolveRunOrError(opts?.advanceRun, defaultRun()),
    "/api/run/retire": () => (opts?.retireRun ? httpError(opts.retireRun) : { ok: true }),
    "/api/lore": () => ({ lore: {} }),
  };
  return (url) => {
    if (routes[url]) return routes[url]();
    if (url.startsWith("/api/shop/"))
      return { shop: makeShopState({ shopUnits: [...defaultShopUnits], ...opts?.shopState }) };
    return undefined;
  };
}

function fetchCallsTo(spy: ReturnType<typeof stubFetch>, path: string) {
  return spy.mock.calls.filter((c) => {
    const url = c[0];
    return typeof url === "string" && url.includes(path);
  });
}

function fetchBodyOf(spy: ReturnType<typeof stubFetch>, path: string) {
  const call = fetchCallsTo(spy, path)[0];
  return call?.[1]?.body ? JSON.parse(call[1].body as string) : undefined;
}

beforeEach(() => {
  resetAllSignals();
  tutorialDone.value = false;
  vi.restoreAllMocks();
  stubSessionRecovery();
  stubFetch(gameRoutes());
});

describe("startGame", () => {
  it("sets phase to SHOP", async () => {
    await startGame("thief");
    expect(phase.value).toBe("SHOP");
  });

  it("sets origin", async () => {
    stubFetch(gameRoutes({ startRun: defaultRun({ originId: "surgeon" }) }));
    await startGame("surgeon");
    expect(origin.value).toBe("surgeon");
  });

  it("sets blood to 10", async () => {
    await startGame("thief");
    expect(blood.value).toBe(10);
  });

  it("sets life to 5", async () => {
    await startGame("thief");
    expect(life.value).toBe(5);
  });

  it("resets trophy to 0", async () => {
    trophy.value = 5;
    await startGame("thief");
    expect(trophy.value).toBe(0);
  });

  it("sets night to 1", async () => {
    night.value = 10;
    await startGame("thief");
    expect(night.value).toBe(1);
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
    stubFetch(
      gameRoutes({
        shopState: {
          shopUnits: [
            { unit: toBoardUnit(makeUnit({ id: "hound" })), frozen: false, eventSourced: false },
            { unit: toBoardUnit(makeUnit({ id: "bat" })), frozen: false, eventSourced: false },
            { unit: toBoardUnit(makeUnit({ id: "rat" })), frozen: false, eventSourced: false },
          ],
        },
      }),
    );
    await startGame("thief");
    expect(shopUnits.value.filter(Boolean).length).toBe(3);
  });

  it("no event on night 1 regardless of tutorial state", async () => {
    tutorialDone.value = false;
    await startGame("thief");
    expect(activeEvent.value).toBeNull();

    tutorialDone.value = true;
    stubFetch(gameRoutes());
    await startGame("thief");
    expect(activeEvent.value).toBeNull();
  });

  it("sets currentRunId from server response", async () => {
    await startGame("thief");
    expect(currentRunId.value).toBe("run-1");
  });

  it("sets currentRunId to null on server error fallback", async () => {
    stubFetch((url) => {
      if (url === "/api/run/start") return httpError(500);
      if (url === "/api/run/current") return { run: null };
      return undefined;
    });
    await startGame("thief");
    expect(currentRunId.value).toBeNull();
  });

  it("sends originId to start endpoint", async () => {
    const spy = stubFetch(gameRoutes());
    await startGame("surgeon");
    expect(fetchBodyOf(spy, "/api/run/start")).toEqual({ originId: "surgeon" });
  });

  it("sets startGameError on server error without entering SHOP", async () => {
    stubFetch((url) => {
      if (url === "/api/run/start") return httpError(500);
      if (url === "/api/run/current") return { run: null };
      return undefined;
    });
    await startGame("thief");
    expect(phase.value).toBe("TITLE");
    expect(startGameError.value).toMatchObject({ type: "API_FETCH_FAILED", status: 500 });
    expect(gameLoading.value).toBe(false);
  });

  it("resumes existing run when getCurrentRun returns active run", async () => {
    const spy = stubFetch(
      gameRoutes({
        currentRun: defaultRun({ night: 3, life: 4, trophy: 2 }),
        shopState: { night: 3, life: 4, trophy: 2 },
      }),
    );
    await startGame("thief");
    expect(night.value).toBe(3);
    expect(life.value).toBe(4);
    expect(trophy.value).toBe(2);
    expect(fetchCallsTo(spy, "/api/run/start")).toHaveLength(0);
  });

  it("prevents double startGame via gameLoading", async () => {
    gameLoading.value = true;
    await startGame("thief");
    expect(phase.value).not.toBe("SHOP");
  });

  it("auto-advances when pendingBattleId exists", async () => {
    const spy = stubFetch(
      gameRoutes({
        currentRun: defaultRun({ night: 2, life: 5, trophy: 1, pendingBattleId: "battle-1" }),
        advanceRun: defaultRun({ night: 3, life: 5, trophy: 2, pendingBattleId: null }),
        shopState: { night: 3, trophy: 2 },
      }),
    );
    await startGame("thief");
    expect(fetchBodyOf(spy, "/api/run/advance")).toEqual({ battleId: "battle-1" });
    expect(night.value).toBe(3);
    expect(trophy.value).toBe(2);
    expect(recoveryWarning.value).toBeNull();
  });

  it("falls back to current run state when advance fails on pending battle", async () => {
    stubFetch(
      gameRoutes({
        currentRun: defaultRun({ night: 2, life: 5, trophy: 1, pendingBattleId: "battle-1" }),
        advanceRun: 500,
        shopState: { night: 2 },
      }),
    );
    await startGame("thief");
    expect(night.value).toBe(2);
    expect(phase.value).toBe("SHOP");
    expect(recoveryWarning.value).toBe("前回の戦闘結果を反映できませんでした");
  });

  it("recovers via re-fetch when advance returns 409", async () => {
    let currentRunCalls = 0;
    stubFetch((url) => {
      if (url === "/api/run/current") {
        currentRunCalls++;
        if (currentRunCalls === 1)
          return {
            run: defaultRun({ night: 2, life: 5, trophy: 1, pendingBattleId: "battle-1" }),
          };
        return { run: defaultRun({ night: 3, life: 5, trophy: 2, pendingBattleId: null }) };
      }
      if (url === "/api/run/advance") return httpError(409);
      if (url.startsWith("/api/shop/")) return { shop: makeShopState({ night: 3, trophy: 2 }) };
      if (url === "/api/lore") return { lore: {} };
      return undefined;
    });
    await startGame("thief");
    expect(night.value).toBe(3);
    expect(trophy.value).toBe(2);
    expect(recoveryWarning.value).toBeNull();
  });

  it("falls back when 409 re-fetch also fails", async () => {
    let currentRunCalls = 0;
    stubFetch((url) => {
      if (url === "/api/run/current") {
        currentRunCalls++;
        if (currentRunCalls === 1)
          return {
            run: defaultRun({ night: 2, life: 5, trophy: 1, pendingBattleId: "battle-1" }),
          };
        return httpError(500);
      }
      if (url === "/api/run/advance") return httpError(409);
      if (url.startsWith("/api/shop/")) return { shop: makeShopState({ night: 2 }) };
      if (url === "/api/lore") return { lore: {} };
      return undefined;
    });
    await startGame("thief");
    expect(night.value).toBe(2);
    expect(recoveryWarning.value).toBe("前回の戦闘結果を反映できませんでした");
  });
});

describe("resumeOrSelectOrigin", () => {
  it("goes to SHOP when active run exists", async () => {
    stubFetch(
      gameRoutes({
        currentRun: defaultRun({ night: 3, life: 4, trophy: 2 }),
        shopState: { night: 3, life: 4, trophy: 2 },
      }),
    );
    await resumeOrSelectOrigin();
    expect(phase.value).toBe("SHOP");
    expect(night.value).toBe(3);
    expect(life.value).toBe(4);
    expect(trophy.value).toBe(2);
  });

  it("goes to ORIGIN when no active run", async () => {
    await resumeOrSelectOrigin();
    expect(phase.value).toBe("ORIGIN");
  });

  it("goes to ORIGIN and sets startGameError when getCurrentRun errors", async () => {
    stubFetch((url) => {
      if (url === "/api/run/current") return httpError(500);
      return undefined;
    });
    await resumeOrSelectOrigin();
    expect(phase.value).toBe("ORIGIN");
    expect(startGameError.value).toMatchObject({ type: "API_FETCH_FAILED", status: 500 });
  });

  it("does not set startGameError when no run exists", async () => {
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
    const spy = stubFetch(
      gameRoutes({
        currentRun: defaultRun({ night: 2, life: 5, trophy: 1, pendingBattleId: "battle-1" }),
        advanceRun: defaultRun({ night: 3, life: 5, trophy: 2, pendingBattleId: null }),
        shopState: { night: 3, trophy: 2 },
      }),
    );
    await resumeOrSelectOrigin();
    expect(fetchBodyOf(spy, "/api/run/advance")).toEqual({ battleId: "battle-1" });
    expect(night.value).toBe(3);
    expect(trophy.value).toBe(2);
    expect(recoveryWarning.value).toBeNull();
  });

  it("sets recoveryWarning when pending battle recovery fails", async () => {
    stubFetch(
      gameRoutes({
        currentRun: defaultRun({ night: 2, life: 5, trophy: 1, pendingBattleId: "battle-1" }),
        advanceRun: 500,
        shopState: { night: 2 },
      }),
    );
    await resumeOrSelectOrigin();
    expect(phase.value).toBe("SHOP");
    expect(night.value).toBe(2);
    expect(recoveryWarning.value).toBe("前回の戦闘結果を反映できませんでした");
  });

  it("recovers via re-fetch when advance returns 409", async () => {
    let currentRunCalls = 0;
    stubFetch((url) => {
      if (url === "/api/run/current") {
        currentRunCalls++;
        if (currentRunCalls === 1)
          return {
            run: defaultRun({ night: 2, life: 5, trophy: 1, pendingBattleId: "battle-1" }),
          };
        return { run: defaultRun({ night: 3, life: 5, trophy: 2, pendingBattleId: null }) };
      }
      if (url === "/api/run/advance") return httpError(409);
      if (url.startsWith("/api/shop/")) return { shop: makeShopState({ night: 3, trophy: 2 }) };
      if (url === "/api/lore") return { lore: {} };
      return undefined;
    });
    await resumeOrSelectOrigin();
    expect(night.value).toBe(3);
    expect(trophy.value).toBe(2);
    expect(recoveryWarning.value).toBeNull();
  });

  it("falls back when 409 re-fetch also fails", async () => {
    let currentRunCalls = 0;
    stubFetch((url) => {
      if (url === "/api/run/current") {
        currentRunCalls++;
        if (currentRunCalls === 1)
          return {
            run: defaultRun({ night: 2, life: 5, trophy: 1, pendingBattleId: "battle-1" }),
          };
        return httpError(500);
      }
      if (url === "/api/run/advance") return httpError(409);
      if (url.startsWith("/api/shop/")) return { shop: makeShopState({ night: 2 }) };
      if (url === "/api/lore") return { lore: {} };
      return undefined;
    });
    await resumeOrSelectOrigin();
    expect(night.value).toBe(2);
    expect(recoveryWarning.value).toBe("前回の戦闘結果を反映できませんでした");
  });

  it("goes to ORIGIN when run has invalid originId", async () => {
    stubFetch(gameRoutes({ currentRun: defaultRun({ originId: null }) }));
    await resumeOrSelectOrigin();
    expect(phase.value).toBe("ORIGIN");
    expect(gameLoading.value).toBe(false);
  });

  it("resets gameLoading after completion", async () => {
    await resumeOrSelectOrigin();
    expect(gameLoading.value).toBe(false);
  });
});

describe("retireGame", () => {
  beforeEach(() => {
    phase.value = "SHOP";
    currentRunId.value = "run-1";
    origin.value = "thief";
    night.value = 5;
    life.value = 3;
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
    expect(night.value).toBe(1);
    expect(life.value).toBe(5);
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
    stubFetch((url) => {
      if (url === "/api/run/retire") return httpError(500);
      if (url === "/api/run/current") return { run: null };
      return undefined;
    });
    await retireGame();
    expect(phase.value).toBe("TITLE");
    expect(currentRunId.value).toBeNull();
    expect(shopActionError.value).toBeNull();
  });

  it("sets shopActionError when retire truly failed", async () => {
    showRetireConfirm.value = true;
    stubFetch((url) => {
      if (url === "/api/run/retire") return httpError(500);
      if (url === "/api/run/current") return { run: defaultRun() };
      return undefined;
    });
    await retireGame();
    expect(phase.value).toBe("SHOP");
    expect(shopActionError.value).toMatchObject({ type: "API_FETCH_FAILED", status: 500 });
    expect(showRetireConfirm.value).toBe(true);
  });

  it("sets shopActionError when verification also fails", async () => {
    showRetireConfirm.value = true;
    stubFetch((url) => {
      if (url === "/api/run/retire") return httpError(500);
      if (url === "/api/run/current") return httpError(500);
      return undefined;
    });
    await retireGame();
    expect(phase.value).toBe("SHOP");
    expect(shopActionError.value).toMatchObject({ type: "API_FETCH_FAILED", status: 500 });
    expect(showRetireConfirm.value).toBe(true);
  });

  it("skips when already retiring", async () => {
    let resolveFetch!: (v: Response) => void;
    const spy = vi.fn((url: string | URL | Request) => {
      const u = toUrlString(url);
      if (u === "/api/run/retire")
        return new Promise<Response>((r) => {
          resolveFetch = r;
        });
      if (u === "/api/run/current")
        return Promise.resolve(new Response(JSON.stringify({ run: null })));
      return Promise.resolve(new Response(JSON.stringify({})));
    });
    vi.stubGlobal("fetch", spy);

    const first = retireGame();
    await retireGame();
    expect(fetchCallsTo(spy, "/retire")).toHaveLength(1);
    resolveFetch(new Response(JSON.stringify({ ok: true })));
    await first;
  });

  it("clears shopActionError at start", async () => {
    shopActionError.value = { type: "API_FETCH_FAILED", status: 500, cause: null };
    await retireGame();
    expect(shopActionError.value).toBeNull();
  });
});

describe("flashResourceError", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets resourceError and auto-clears after 500ms", () => {
    flashResourceError("blood");
    expect(resourceError.value).toBe("blood");
    vi.advanceTimersByTime(499);
    expect(resourceError.value).toBe("blood");
    vi.advanceTimersByTime(1);
    expect(resourceError.value).toBeNull();
  });

  it("consecutive calls cancel previous timer", () => {
    flashResourceError("blood");
    vi.advanceTimersByTime(300);
    flashResourceError("life");
    expect(resourceError.value).toBe("life");
    vi.advanceTimersByTime(300);
    expect(resourceError.value).toBe("life");
    vi.advanceTimersByTime(200);
    expect(resourceError.value).toBeNull();
  });
});
