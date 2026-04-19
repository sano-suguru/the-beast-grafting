import { invariant } from "../shared/invariant";
import { atLevel, ZEALOT } from "../shared/skill-params";
import type { UnitInstance } from "../shared/types";
import type { Rng } from "./rng";

function getActiveIndices(board: (UnitInstance | null)[]): number[] {
  return board.map((u, i) => (u ? i : null)).filter((i): i is number => i !== null);
}

function pickRandomTarget(
  board: (UnitInstance | null)[],
  rng: Rng,
  excludeIdx?: number,
): number | null {
  const active = getActiveIndices(board).filter((i) => i !== excludeIdx);
  if (active.length === 0) return null;
  return active[Math.floor(rng.next() * active.length)]!;
}

export function buffRandomUnit(
  board: (UnitInstance | null)[],
  atkBuff: number,
  hpBuff: number,
  rng: Rng,
  excludeIdx?: number,
): void {
  const idx = pickRandomTarget(board, rng, excludeIdx);
  if (idx === null) return;
  const target = board[idx]!;
  board[idx] = { ...target, buffAtk: target.buffAtk + atkBuff, buffHp: target.buffHp + hpBuff };
}

/** Zealot バフ量を計算する共通ロジック */
export function computeZealotBuff<T extends { id: string; level: number; hp: number }>(
  units: T[],
  opts: { requireAlive: true; getMultiplier?: (idx: number) => number },
): number;
export function computeZealotBuff<T extends { id: string; level: number }>(
  units: T[],
  opts: { requireAlive: false; getMultiplier?: (idx: number) => number },
): number;
export function computeZealotBuff<T extends { id: string; level: number; hp?: number }>(
  units: T[],
  opts: {
    requireAlive: boolean;
    getMultiplier?: (idx: number) => number;
  },
): number {
  let total = 0;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u || u.id !== "zealot") continue;
    if (opts.requireAlive) {
      invariant(typeof u.hp === "number", "hp required when requireAlive is true");
      if (u.hp <= 0) continue;
    }
    const buff = atLevel(ZEALOT.summonBuff, u.level);
    total += buff * (opts.getMultiplier ? opts.getMultiplier(i) : 1);
  }
  return total;
}
