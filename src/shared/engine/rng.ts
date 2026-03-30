import { invariant } from "../invariant";

export interface Rng {
  next(): number;
}

/** xorshift128+ seeded PRNG — deterministic given the same seed. */
export function createSeededRng(seed: number): Rng {
  invariant(seed !== 0 && Number.isFinite(seed), `invalid RNG seed: ${seed}`);
  let s0 = seed | 0 || 1;
  let s1 = (seed * 1103515245 + 12345) | 0 || 1;
  return {
    next() {
      let a = s0;
      const b = s1;
      s0 = b;
      a ^= a << 23;
      a ^= a >> 17;
      a ^= b;
      a ^= b >> 26;
      s1 = a;
      return ((s0 + s1) >>> 0) / 0x100000000;
    },
  };
}

/** Default RNG delegating to Math.random(). */
export function createDefaultRng(): Rng {
  return { next: () => Math.random() };
}
