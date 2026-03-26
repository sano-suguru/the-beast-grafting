vi.mock("../engine/audio", () => ({
  initAudio: vi.fn(),
  playSE: vi.fn(),
}));

import { startGame } from "./game-actions";
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
  onboardingStep,
} from "./game-store";

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
});

describe("startGame", () => {
  it("sets phase to SHOP", () => {
    startGame("thief");
    expect(phase.value).toBe("SHOP");
  });

  it("sets origin", () => {
    startGame("surgeon");
    expect(origin.value).toBe("surgeon");
  });

  it("sets blood to 10", () => {
    startGame("thief");
    expect(blood.value).toBe(10);
  });

  it("sets sanity to 5 for most origins", () => {
    startGame("thief");
    expect(sanity.value).toBe(5);
  });

  it("sets sanity to 5 for inquisitor", () => {
    startGame("inquisitor");
    expect(sanity.value).toBe(5);
  });

  it("resets trophy to 0", () => {
    trophy.value = 5;
    startGame("thief");
    expect(trophy.value).toBe(0);
  });

  it("sets round to 1", () => {
    round.value = 10;
    startGame("thief");
    expect(round.value).toBe(1);
  });

  it("clears board", () => {
    startGame("thief");
    expect(board.value).toEqual([null, null, null, null, null]);
  });

  it("sets onboardingStep to buy when tutorial not done", () => {
    startGame("thief");
    expect(onboardingStep.value).toBe("buy");
  });

  it("sets onboardingStep to null when tutorialDone is true", () => {
    tutorialDone.value = true;
    startGame("thief");
    expect(onboardingStep.value).toBeNull();
  });

  it("resets lastBattleResult", () => {
    lastBattleResult.value = "WIN";
    startGame("thief");
    expect(lastBattleResult.value).toBeNull();
  });
});
