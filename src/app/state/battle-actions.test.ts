vi.mock("../engine/audio", () => ({
  initAudio: vi.fn(),
  playSE: vi.fn(),
}));

vi.mock("../api/fetch", () => ({
  apiFetch: vi.fn(),
}));

import {
  startPreBattle,
  startActualBattle,
  concludeBattle,
  retryBattle,
  abandonBattle,
  resetBattleInternals,
} from "./battle-actions";
import * as lore from "./lore";
import { apiFetch } from "../api/fetch";
import { ok, err } from "../../shared/errors";
import type { InfraError } from "../../shared/errors";
import { createRoutedApiFetch } from "../api/test-helpers";

const mockApiFetch = vi.mocked(apiFetch);
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
  onboardingStep,
  origin,
  blood,
  freeRoll,
  cultistUsed,
  shopUnits,
  shopItems,
} from "./game-store";
import { makeUnit } from "../../shared/engine/test-helpers";

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
      teamType: "同業者",
      units: [],
    },
    seed: 42,
  };
}

function defaultRunState(overrides: Record<string, unknown> = {}) {
  return {
    run: {
      id: "run-1",
      round: 2,
      sanity: 5,
      trophy: 1,
      status: "active",
      originId: null,
      ...overrides,
    },
  };
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
  onboardingStep.value = null;
  origin.value = null;
  blood.value = 10;
  freeRoll.value = false;
  cultistUsed.value = false;
  shopUnits.value = [];
  shopItems.value = [];
  resetBattleInternals();
  mockApiFetch.mockReset();
  mockApiFetch.mockImplementation(
    createRoutedApiFetch({
      "/api/pvp/snapshot": { ok: true },
      "/api/pvp/battle": defaultBattleResponse(),
      "/api/run/advance": defaultRunState(),
    }),
  );
});

describe("startPreBattle", () => {
  it("sets phase to PRE_BATTLE", () => {
    startPreBattle();
    expect(phase.value).toBe("PRE_BATTLE");
  });

  it("does nothing with empty board", () => {
    board.value = [null, null, null, null, null];
    startPreBattle();
    expect(phase.value).toBe("SHOP");
  });

  it("clears selection", () => {
    selection.value = { type: "BOARD_UNIT", index: 0, item: makeUnit() };
    startPreBattle();
    expect(selection.value).toBeNull();
  });

  it("does not set enemy team (resolved at battle time)", () => {
    startPreBattle();
    expect(currentEnemyTeam.value).toBeNull();
  });

  it("clears onboarding step when battle", () => {
    onboardingStep.value = "battle";
    startPreBattle();
    expect(onboardingStep.value).toBeNull();
  });

  it("applies end-of-turn machine buff to front unit", () => {
    const front = makeUnit({ id: "hound", atk: 3, hp: 5 });
    const machine = makeUnit({ id: "machine", atk: 1, hp: 2 });
    board.value = [front, machine, null, null, null];
    startPreBattle();
    expect(board.value[0]!.atk).toBe(5);
    expect(board.value[0]!.hp).toBe(7);
  });

  it("revenant is not buffed in shop phase (moved to battle start skills)", () => {
    lastBattleResult.value = "LOSE";
    const rev = makeUnit({ id: "revenant", atk: 2, hp: 2 });
    const ally = makeUnit({ id: "hound", atk: 3, hp: 3 });
    board.value = [rev, ally, null, null, null];
    startPreBattle();
    expect(board.value[0]!.atk).toBe(2);
    expect(board.value[1]!.atk).toBe(3);
  });
});

describe("startActualBattle", () => {
  it("runs server battle and sets frames on success", async () => {
    phase.value = "PRE_BATTLE";
    startActualBattle();
    await vi.waitFor(() => {
      expect(phase.value).toBe("BATTLE");
    });
    expect(battleFrames.value.length).toBeGreaterThan(0);
    expect(currentFrameIdx.value).toBe(0);
    expect(fastForward.value).toBe(false);
  });

  it("sets battleResult and lastBattleResult", async () => {
    phase.value = "PRE_BATTLE";
    startActualBattle();
    await vi.waitFor(() => {
      expect(battleResult.value).not.toBeNull();
    });
    expect(lastBattleResult.value).toBe(battleResult.value);
  });

  it("proceeds to battle even without pre-set enemy team", async () => {
    phase.value = "PRE_BATTLE";
    currentEnemyTeam.value = null;
    startActualBattle();
    await vi.waitFor(() => {
      expect(phase.value).toBe("BATTLE");
    });
  });

  it("stores lastBattleId on server success", async () => {
    phase.value = "PRE_BATTLE";
    startActualBattle();
    await vi.waitFor(() => {
      expect(phase.value).toBe("BATTLE");
    });
    expect(lastBattleId.value).toBe("test-battle-id");
  });

  it("does nothing when battleBusy is true", async () => {
    battleBusy.value = true;
    phase.value = "PRE_BATTLE";
    startActualBattle();
    expect(phase.value).toBe("PRE_BATTLE");
  });

  it("sets battleError when no runId", async () => {
    currentRunId.value = null;
    phase.value = "PRE_BATTLE";
    startActualBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(battleError.value).not.toBeNull();
    expect(phase.value).toBe("BATTLE_LOADING");
  });

  it("sets battleError on server failure", async () => {
    const infraErr: InfraError = { type: "API_FETCH_FAILED", status: 500, cause: null };
    mockApiFetch.mockImplementation(async (path) => {
      if (typeof path === "string" && path.startsWith("/api/pvp/battle")) {
        return err(infraErr);
      }
      return ok({ ok: true });
    });
    phase.value = "PRE_BATTLE";
    startActualBattle();
    await vi.waitFor(() => {
      expect(battleError.value).not.toBeNull();
    });
    expect(phase.value).toBe("BATTLE_LOADING");
  });
});

describe("concludeBattle", () => {
  it("increments trophy on win from server", async () => {
    battleResult.value = "WIN";
    trophy.value = 3;
    lastBattleId.value = "b-1";
    mockApiFetch.mockImplementation(
      createRoutedApiFetch({
        "/api/run/advance": defaultRunState({ trophy: 4 }),
      }),
    );
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(trophy.value).toBe(4);
  });

  it("calls advanceRun with battleId", async () => {
    battleResult.value = "WIN";
    lastBattleId.value = "b-1";
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/run/advance",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ battleId: "b-1" }),
      }),
    );
  });

  it("advances round from server response", async () => {
    battleResult.value = "WIN";
    round.value = 2;
    lastBattleId.value = "b-1";
    mockApiFetch.mockImplementation(
      createRoutedApiFetch({
        "/api/run/advance": defaultRunState({ round: 3, trophy: 1 }),
      }),
    );
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(round.value).toBe(3);
    expect(phase.value).toBe("SHOP");
  });

  it("decrements sanity on loss from server", async () => {
    battleResult.value = "LOSE";
    sanity.value = 3;
    lastBattleId.value = "b-1";
    mockApiFetch.mockImplementation(
      createRoutedApiFetch({
        "/api/run/advance": defaultRunState({ sanity: 2, trophy: 0 }),
      }),
    );
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(sanity.value).toBe(2);
  });

  it("game over when server returns lost status", async () => {
    battleResult.value = "LOSE";
    sanity.value = 1;
    lastBattleId.value = "b-1";
    mockApiFetch.mockImplementation(
      createRoutedApiFetch({
        "/api/run/advance": defaultRunState({ sanity: 0, trophy: 0, status: "lost" }),
      }),
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
    mockApiFetch.mockImplementation(
      createRoutedApiFetch({
        "/api/run/advance": defaultRunState({ sanity: 5, trophy: 10, status: "won" }),
      }),
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
    mockApiFetch.mockImplementation(
      createRoutedApiFetch({
        "/api/run/advance": defaultRunState({ round: 3, sanity: 5, trophy: 3 }),
      }),
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
    mockApiFetch.mockImplementation(
      createRoutedApiFetch({
        "/api/run/advance": defaultRunState({ sanity: 5, trophy: 10, status: "won" }),
      }),
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
    mockApiFetch.mockResolvedValue(err({ type: "API_FETCH_FAILED", status: 500, cause: null }));
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
    concludeBattle();
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
    expect(trophy.value).toBe(4);
    expect(round.value).toBe(3);
    expect(phase.value).toBe("SHOP");
  });
});

describe("startPreBattle – PvP snapshot upload", () => {
  it("calls uploadSnapshot with runId, round, and board units", () => {
    const unit = makeUnit({ atk: 7, hp: 5 });
    board.value = [unit, null, null, null, null];
    round.value = 3;
    startPreBattle();
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/pvp/snapshot",
      expect.objectContaining({
        method: "POST",
      }),
    );
    const call = mockApiFetch.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0] === "/api/pvp/snapshot",
    );
    expect(call).toBeDefined();
    const body = JSON.parse((call![1] as RequestInit).body as string);
    expect(body.runId).toBe("test-run-id");
    expect(body.round).toBe(3);
    expect(body.board[0].atk).toBe(7);
  });

  it("does not upload snapshot when no runId", () => {
    currentRunId.value = null;
    board.value = [makeUnit(), null, null, null, null];
    startPreBattle();
    expect(mockApiFetch).not.toHaveBeenCalledWith("/api/pvp/snapshot", expect.anything());
  });

  it("proceeds to battle despite upload failure", async () => {
    mockApiFetch.mockImplementation(async (path) => {
      if (typeof path === "string" && path === "/api/pvp/snapshot") {
        return err({ type: "API_FETCH_FAILED", status: 500, cause: null } as InfraError);
      }
      if (typeof path === "string" && path.startsWith("/api/pvp/battle")) {
        return ok(defaultBattleResponse());
      }
      return ok({ ok: true });
    });
    board.value = [makeUnit(), null, null, null, null];
    startPreBattle();
    expect(phase.value).toBe("PRE_BATTLE");
    startActualBattle();
    await vi.waitFor(() => expect(phase.value).toBe("BATTLE"));
    expect(battleError.value).toBeNull();
  });

  it("does not call uploadSnapshot with empty board", () => {
    board.value = [null, null, null, null, null];
    startPreBattle();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});

describe("retryBattle", () => {
  it("retries battle when phase is BATTLE_LOADING", async () => {
    phase.value = "BATTLE_LOADING";
    battleError.value = { type: "API_FETCH_FAILED", status: 0, cause: null };
    retryBattle();
    expect(battleBusy.value).toBe(true);
    await vi.waitFor(() => expect(battleBusy.value).toBe(false));
  });

  it("does nothing when phase is not BATTLE_LOADING", () => {
    phase.value = "SHOP";
    retryBattle();
    expect(battleBusy.value).toBe(false);
  });

  it("does nothing when battleBusy is true", () => {
    phase.value = "BATTLE_LOADING";
    battleBusy.value = true;
    retryBattle();
    expect(phase.value).toBe("BATTLE_LOADING");
  });
});

describe("abandonBattle", () => {
  it("resets to SHOP phase and clears error", () => {
    phase.value = "BATTLE_LOADING";
    battleError.value = { type: "API_FETCH_FAILED", status: 0, cause: null };
    abandonBattle();
    expect(phase.value).toBe("SHOP");
    expect(battleError.value).toBeNull();
    expect(battleBusy.value).toBe(false);
  });
});
