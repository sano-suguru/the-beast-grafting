import { invariant } from "../shared/invariant";

export interface Rng {
  next(): number;
}

export interface RngState {
  s0: number;
  s1: number;
}

export interface StatefulRng extends Rng {
  getState(): RngState;
}

function createXorshift128plus(initialS0: number, initialS1: number): StatefulRng {
  let s0 = initialS0;
  let s1 = initialS1;
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
    getState() {
      return { s0, s1 };
    },
  };
}

/** xorshift128+ seeded PRNG — deterministic given the same seed. */
export function createSeededRng(seed: number): StatefulRng {
  invariant(seed !== 0 && Number.isFinite(seed), `invalid RNG seed: ${seed}`);
  return createXorshift128plus(seed | 0 || 1, (seed * 1103515245 + 12345) | 0 || 1);
}

/** Restore RNG from a previously saved state. */
export function restoreRng(state: RngState): StatefulRng {
  invariant(state.s0 !== 0 || state.s1 !== 0, "RNG state must not be all-zero");
  return createXorshift128plus(state.s0, state.s1);
}
