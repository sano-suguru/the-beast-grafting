import type { RegularUnitId } from "../../shared/types";
import type { Rng } from "../rng";
import type { SynergyTag } from "./sim-types";
import { UNIT_PROFILES, computeSynergyWeight } from "./sim-synergy";
import { getShopPool } from "../helpers";
import { invariant } from "../../shared/invariant";

const TEAM_SIZE = 5;

function weightedPick<T>(items: readonly T[], weights: readonly number[], rng: Rng): T {
  let total = 0;
  for (const w of weights) total += w;
  invariant(total > 0, "weightedPick: total weight must be positive");

  let roll = rng.next() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

function collectTeamTags(selected: readonly RegularUnitId[]): SynergyTag[] {
  const tags: SynergyTag[] = [];
  for (const id of selected) {
    const profile = UNIT_PROFILES[id];
    for (const t of profile.tags) tags.push(t);
  }
  return tags;
}

/**
 * シナジー重み付きランダム選択でチームを生成する。
 *
 * 1体目は均等重み。2体目以降は既選択ユニットとシナジーがあれば ×3 の重み。
 * 重複なし — 選択済みユニットはプールから除去される。
 */
export function generateSimTeam(night: number, rng: Rng): RegularUnitId[] {
  const available = [...new Set(getShopPool(night))];
  const selected: RegularUnitId[] = [];

  for (let slot = 0; slot < TEAM_SIZE; slot++) {
    invariant(available.length > 0, "generateSimTeam: pool exhausted");
    const existingTags = collectTeamTags(selected);
    const weights = available.map((id) => {
      const candidateTags = UNIT_PROFILES[id].tags;
      return computeSynergyWeight(candidateTags, existingTags);
    });

    const picked = weightedPick(available, weights, rng);
    selected.push(picked);
    available.splice(available.indexOf(picked), 1);
  }

  return selected;
}
