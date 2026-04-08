import { invariant } from "../shared/invariant";
import { atLevel, ZEALOT } from "../shared/skill-params";

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
