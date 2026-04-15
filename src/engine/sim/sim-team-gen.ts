import type { RegularUnitId } from "../../shared/types";
import type { Rng } from "../rng";
import { getShopPool } from "../helpers";
import { invariant } from "../../shared/invariant";
import { TEAM_SIZE } from "./sim-types";

/**
 * 一様ランダム選択でチームを生成する。
 * 重複なし — 選択済みユニットはプールから除去される。
 */
export function generateSimTeam(night: number, rng: Rng): RegularUnitId[] {
  const available = [...new Set(getShopPool(night))];
  const selected: RegularUnitId[] = [];

  for (let slot = 0; slot < TEAM_SIZE; slot++) {
    invariant(available.length > 0, "generateSimTeam: pool exhausted");
    const idx = Math.floor(rng.next() * available.length);
    selected.push(available[idx]!);
    available.splice(idx, 1);
  }

  return selected;
}
