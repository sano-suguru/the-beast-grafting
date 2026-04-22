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

/** Zealot バフ量を計算する共通ロジック。
 *  getRepeatLevel を渡すと、各 zealot について brains の再発動レベルを問い合わせ、
 *  非 null の場合はそのレベルでの buff 値を追加で加算する(SAP の Tiger 再発動準拠)。 */
export function computeZealotBuff<T extends { id: string; level: number; hp: number }>(
  units: T[],
  opts: { requireAlive: true; getRepeatLevel?: (idx: number) => number | null },
): number;
export function computeZealotBuff<T extends { id: string; level: number }>(
  units: T[],
  opts: { requireAlive: false; getRepeatLevel?: (idx: number) => number | null },
): number;
export function computeZealotBuff<T extends { id: string; level: number; hp?: number }>(
  units: T[],
  opts: {
    requireAlive: boolean;
    getRepeatLevel?: (idx: number) => number | null;
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
    total += atLevel(ZEALOT.summonBuff, u.level);
    const repeatLevel = opts.getRepeatLevel?.(i);
    if (repeatLevel != null) total += atLevel(ZEALOT.summonBuff, repeatLevel);
  }
  return total;
}
