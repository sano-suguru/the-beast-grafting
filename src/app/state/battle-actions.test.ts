vi.mock("../engine/audio", () => ({
  initAudio: vi.fn(),
  playSE: vi.fn(),
}));

import { startPreBattle, startActualBattle, concludeBattle } from "./battle-actions";
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
  onboardingStep,
  origin,
  blood,
  freeRoll,
  cultistUsed,
  shopUnits,
  shopItems,
} from "./game-store";
import { makeUnit, makeEnemyTeam } from "../engine/test-helpers";

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
  onboardingStep.value = null;
  origin.value = null;
  blood.value = 10;
  freeRoll.value = false;
  cultistUsed.value = false;
  shopUnits.value = [];
  shopItems.value = [];
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

  it("generates enemy team if none exists", () => {
    startPreBattle();
    expect(currentEnemyTeam.value).not.toBeNull();
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
  it("runs battle and sets frames", async () => {
    phase.value = "PRE_BATTLE";
    currentEnemyTeam.value = makeEnemyTeam([makeUnit({ atk: 1, hp: 1 })]);
    startActualBattle();
    // Wait for async worker fallback to complete
    await vi.waitFor(() => {
      expect(phase.value).toBe("BATTLE");
    });
    expect(battleFrames.value.length).toBeGreaterThan(0);
    expect(currentFrameIdx.value).toBe(0);
    expect(fastForward.value).toBe(false);
  });

  it("sets battleResult and lastBattleResult", async () => {
    phase.value = "PRE_BATTLE";
    currentEnemyTeam.value = makeEnemyTeam([makeUnit({ atk: 1, hp: 1 })]);
    startActualBattle();
    await vi.waitFor(() => {
      expect(battleResult.value).not.toBeNull();
    });
    expect(lastBattleResult.value).toBe(battleResult.value);
  });

  it("does nothing without enemy team", () => {
    currentEnemyTeam.value = null;
    startActualBattle();
    expect(phase.value).toBe("SHOP");
  });
});

describe("concludeBattle", () => {
  it("increments trophy on win", () => {
    battleResult.value = "WIN";
    trophy.value = 3;
    concludeBattle();
    expect(trophy.value).toBe(4);
  });

  it("advances to next round on win", () => {
    battleResult.value = "WIN";
    round.value = 2;
    concludeBattle();
    expect(round.value).toBe(3);
    expect(phase.value).toBe("SHOP");
  });

  it("decrements sanity on loss", () => {
    battleResult.value = "LOSE";
    sanity.value = 3;
    concludeBattle();
    expect(sanity.value).toBe(2);
  });

  it("game over when sanity reaches 0 on loss", () => {
    battleResult.value = "LOSE";
    sanity.value = 1;
    concludeBattle();
    expect(sanity.value).toBe(0);
    expect(phase.value).toBe("RESULT");
  });

  it("game clear at 10 trophies", () => {
    battleResult.value = "WIN";
    trophy.value = 9;
    concludeBattle();
    expect(trophy.value).toBe(10);
    expect(phase.value).toBe("RESULT");
  });

  it("draw advances round without changing sanity or trophy", () => {
    battleResult.value = "DRAW";
    sanity.value = 5;
    trophy.value = 3;
    round.value = 2;
    concludeBattle();
    expect(sanity.value).toBe(5);
    expect(trophy.value).toBe(3);
    expect(round.value).toBe(3);
    expect(phase.value).toBe("SHOP");
  });
});
