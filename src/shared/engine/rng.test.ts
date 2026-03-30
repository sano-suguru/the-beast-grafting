import { createSeededRng } from "./rng";

describe("createSeededRng", () => {
  it("handles fractional seed where (seed | 0) === 0", () => {
    // seed = 0.5 → s0 = (0.5 | 0) || 1 = 0 || 1 = 1
    const rng = createSeededRng(0.5);
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("throws on seed = 0", () => {
    expect(() => createSeededRng(0)).toThrow();
  });
});
