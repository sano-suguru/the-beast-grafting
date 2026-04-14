import type { RegularUnitId } from "../../shared/types";
import { UNIT_PROFILES } from "./sim-synergy";
import { lookupUnitData } from "../../shared/data/unit-lookup";
import { invariant } from "../../shared/invariant";

/** HP重視の前衛適性スコア (HP × 10 + ATK) */
function frontPriority(id: RegularUnitId): number {
  const data = lookupUnitData(id);
  invariant(data, `unknown unit: ${id}`);
  return data.baseHp * 10 + data.baseAtk;
}

function getRole(id: RegularUnitId): string {
  return UNIT_PROFILES[id].role;
}

function hasTag(id: RegularUnitId, tag: string): boolean {
  return (UNIT_PROFILES[id].tags as readonly string[]).includes(tag);
}

/**
 * ユニット配列をバトル最適なポジションに並べ替える。
 *
 * 返り値は simulateBattle の入力順序: index 0 = back, 末尾 = front。
 * (initContext が .reverse() するため)
 *
 * バトルポジション:
 *   0 = front (攻撃・被弾)
 *   1 = support (before-attack スキル発動)
 *   2-4 = back
 */
export function optimizePositions(ids: readonly RegularUnitId[]): RegularUnitId[] {
  invariant(ids.length > 0 && ids.length <= 5, "optimizePositions: team size must be 1-5");

  const battleSlots: (RegularUnitId | null)[] = Array.from({ length: ids.length }, () => null);
  const remaining = new Set(ids);

  assignKeyPositions(battleSlots, ids, remaining);
  fillRemaining(battleSlots, remaining);

  const result = battleSlots.filter((id): id is RegularUnitId => id !== null);
  return result.toReversed();
}

function assignKeyPositions(
  battleSlots: (RegularUnitId | null)[],
  ids: readonly RegularUnitId[],
  remaining: Set<RegularUnitId>,
): void {
  const supportUnits = ids.filter((id) => getRole(id) === "support");
  const hasSupport = supportUnits.length > 0;

  // brains + support → brains を position 2 (support の before-attack を 2 倍)
  if (remaining.has("brains") && hasSupport && ids.length > 2) {
    battleSlots[2] = "brains";
    remaining.delete("brains");
  }

  // support → position 1
  if (hasSupport && ids.length > 1) {
    const best = pickBest(supportUnits.filter((id) => remaining.has(id)));
    if (best) {
      battleSlots[1] = best;
      remaining.delete(best);
    }
  }

  // brains + support 無し → brains を position 1
  if (remaining.has("brains") && ids.length > 1) {
    battleSlots[1] = "brains";
    remaining.delete("brains");
  }

  assignFront(battleSlots, remaining);

  // puppeteer → death-provider/spawner の 1 つ前
  if (remaining.has("puppeteer")) {
    placePuppeteer(battleSlots, ids, remaining);
  }
}

function assignFront(battleSlots: (RegularUnitId | null)[], remaining: Set<RegularUnitId>): void {
  if (battleSlots[0] !== null || remaining.size === 0) return;
  const all = [...remaining];
  const frontCandidates = all.filter((id) => getRole(id) === "front");
  const flexCandidates = all.filter((id) => getRole(id) !== "support");
  let candidates = all;
  if (frontCandidates.length > 0) candidates = frontCandidates;
  else if (flexCandidates.length > 0) candidates = flexCandidates;
  const best = pickBest(candidates)!;
  battleSlots[0] = best;
  remaining.delete(best);
}

function fillRemaining(battleSlots: (RegularUnitId | null)[], remaining: Set<RegularUnitId>): void {
  const rest = [...remaining];
  const backPreferred = rest.filter((id) => hasTag(id, "death-reactor") || hasTag(id, "avenge"));
  const others = rest.filter((id) => !hasTag(id, "death-reactor") && !hasTag(id, "avenge"));
  const toPlace = [...others, ...backPreferred];

  for (let i = battleSlots.length - 1; i >= 0; i--) {
    if (battleSlots[i] === null && toPlace.length > 0) {
      battleSlots[i] = toPlace.pop()!;
    }
  }
}

function pickBest(candidates: RegularUnitId[]): RegularUnitId | undefined {
  if (candidates.length === 0) return undefined;
  return candidates.reduce((a, b) => (frontPriority(a) >= frontPriority(b) ? a : b));
}

function placePuppeteer(
  battleSlots: (RegularUnitId | null)[],
  allIds: readonly RegularUnitId[],
  remaining: Set<RegularUnitId>,
): void {
  if (!remaining.has("puppeteer")) return;

  const deathUnits = allIds.filter(
    (id) => id !== "puppeteer" && (hasTag(id, "death-provider") || hasTag(id, "spawner")),
  );
  if (deathUnits.length === 0) return;

  const bestDeath = pickBest(deathUnits)!;
  const deathIdx = battleSlots.indexOf(bestDeath);
  if (deathIdx <= 0) return;

  if (battleSlots[deathIdx - 1] === null) {
    battleSlots[deathIdx - 1] = "puppeteer";
    remaining.delete("puppeteer");
  }
}
