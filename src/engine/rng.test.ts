import { createSeededRng, restoreRng } from "./rng";

describe("createSeededRng", () => {
  it("handles fractional seed where (seed | 0) === 0", () => {
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

  it("getState returns current internal state", () => {
    const rng = createSeededRng(42);
    const before = rng.getState();
    rng.next();
    const after = rng.getState();
    expect(before).not.toEqual(after);
  });
});

describe("restoreRng", () => {
  it("produces the same sequence from a saved state", () => {
    const rng1 = createSeededRng(12345);
    rng1.next();
    rng1.next();
    rng1.next();
    const saved = rng1.getState();
    const expected = [rng1.next(), rng1.next(), rng1.next()];

    const rng2 = restoreRng(saved);
    const actual = [rng2.next(), rng2.next(), rng2.next()];
    expect(actual).toEqual(expected);
  });

  it("throws on all-zero state", () => {
    expect(() => restoreRng({ s0: 0, s1: 0 })).toThrow();
  });

  it("getState matches after restoration", () => {
    const rng1 = createSeededRng(99);
    rng1.next();
    const state = rng1.getState();
    const rng2 = restoreRng(state);
    expect(rng2.getState()).toEqual(state);
    rng1.next();
    rng2.next();
    expect(rng2.getState()).toEqual(rng1.getState());
  });
});
