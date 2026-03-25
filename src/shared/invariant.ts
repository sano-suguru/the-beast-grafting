/** Fail-fast assertion for engine invariants. Violation = bug in the code. */
export function invariant(condition: unknown, msg: string): asserts condition {
  if (!condition) {
    /* oxlint-disable-next-line eslint-js/no-restricted-syntax */
    throw new Error(`[INVARIANT] ${msg}`);
  }
}

/** Type-safe array access with invariant check. Use after bounds are verified. */
export function mustGet<T>(arr: readonly T[], idx: number, msg: string): T {
  const item = arr[idx];
  invariant(item !== undefined, msg);
  return item;
}
