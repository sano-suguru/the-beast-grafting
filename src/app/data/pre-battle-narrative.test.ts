import { toLifeTier } from "../../shared/types";
import { selectPreBattleNarrative } from "./pre-battle-narrative";

describe("toLifeTier", () => {
  it.each([
    [5, "high"],
    [4, "high"],
    [3, "mid"],
    [2, "mid"],
    [1, "low"],
    [0, "low"],
  ] as const)("life %d → %s", (life, expected) => {
    expect(toLifeTier(life)).toBe(expected);
  });
});

describe("selectPreBattleNarrative", () => {
  const FACTIONS = ["教団", "同業者"] as const;

  it("returns valid text for all tier × faction combinations", () => {
    for (const life of [5, 2, 1]) {
      for (const faction of FACTIONS) {
        const result = selectPreBattleNarrative(life, faction, 1);
        expect(result.intro).toBeTruthy();
        expect(result.closing).toBeTruthy();
      }
    }
  });

  it("is deterministic: same inputs produce same output", () => {
    const a = selectPreBattleNarrative(4, "教団", 3);
    const b = selectPreBattleNarrative(4, "教団", 3);
    expect(a).toEqual(b);
  });

  it("produces variation across different rounds", () => {
    const results = new Set<string>();
    for (let round = 1; round <= 10; round++) {
      results.add(selectPreBattleNarrative(5, "教団", round).intro);
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it("throws on unknown enemy type", () => {
    expect(() => selectPreBattleNarrative(5, "unknown" as never, 1)).toThrow("[INVARIANT]");
  });
});
