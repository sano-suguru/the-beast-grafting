import type { RegularUnitId } from "../../shared/types";
import type { Rng } from "../rng";
import { getShopPool } from "../helpers";
import { invariant } from "../../shared/invariant";
import { TEAM_SIZE } from "./sim-types";
import { getShopSize } from "../shop-generation";
import { PURCHASES_PER_NIGHT } from "./sim-shop-acquisition";
import type { ShopHistory } from "./sim-shop-history";

/**
 * 実ショップ遭遇に近い分布からチームを生成する。
 *
 * 各 night について複数回のショップ閲覧を近似し、実際に並んだオファー回数を重みとして
 * 重複なしサンプリングを行う。これにより「解禁済みユニットの一様抽選」で tier / 時間差 /
 * ショップ枠数が潰れる歪みを避ける。
 */
const SHOP_VIEWS_PER_NIGHT = 4;
type EncounterWeights = {
  readonly ids: readonly RegularUnitId[];
  readonly weights: Float64Array;
  readonly totalWeight: number;
};

const encounterWeightCache = new Map<number, EncounterWeights>();

function pickWeightedIndex(weights: Float64Array, target: number): number {
  let cumulative = 0;
  let chosenIndex: number | null = null;
  for (let i = 0; i < weights.length; i++) {
    const weight = weights[i]!;
    if (weight <= 0) continue;
    cumulative += weight;
    if (target < cumulative) {
      chosenIndex = i;
      break;
    }
  }
  invariant(chosenIndex !== null, "pickWeightedIndex: target must land within positive weights");
  return chosenIndex;
}

function getEncounterWeights(night: number): EncounterWeights {
  const cached = encounterWeightCache.get(night);
  if (cached) return cached;

  const weights = new Map<RegularUnitId, number>();
  for (let currentNight = 1; currentNight <= night; currentNight++) {
    const pool = getShopPool(currentNight);
    const perUnitWeight = (getShopSize(currentNight) * SHOP_VIEWS_PER_NIGHT) / pool.length;
    for (const id of pool) {
      weights.set(id, (weights.get(id) ?? 0) + perUnitWeight);
    }
  }

  const entries = [...weights.entries()].filter(([, weight]) => weight > 0);
  const prepared = {
    ids: Object.freeze(entries.map(([id]) => id)),
    weights: Float64Array.from(entries, ([, weight]) => weight),
    totalWeight: entries.reduce((sum, [, weight]) => sum + weight, 0),
  };
  encounterWeightCache.set(night, prepared);
  return prepared;
}

function weightedUniqueSample(weights: EncounterWeights, rng: Rng): RegularUnitId[] {
  const liveWeights = weights.weights.slice();
  let totalWeight = weights.totalWeight;
  const selected: RegularUnitId[] = [];

  while (selected.length < TEAM_SIZE && totalWeight > 0) {
    invariant(totalWeight > 0, "weightedUniqueSample: totalWeight must be positive");
    const chosenIndex = pickWeightedIndex(liveWeights, rng.next() * totalWeight);
    const chosenWeight = liveWeights[chosenIndex]!;
    invariant(chosenWeight > 0, "weightedUniqueSample: chosen weight must be positive");
    selected.push(weights.ids[chosenIndex]!);
    totalWeight -= chosenWeight;
    liveWeights[chosenIndex] = 0;
  }

  return selected;
}

export function generateSimTeam(night: number, rng: Rng): RegularUnitId[] {
  const selected = weightedUniqueSample(getEncounterWeights(night), rng);
  invariant(selected.length === TEAM_SIZE, "generateSimTeam: failed to sample full team");
  return selected;
}

export function generateSimTeamWithHistory(
  night: number,
  rng: Rng,
): { ids: RegularUnitId[]; history: ShopHistory } {
  const roster: RegularUnitId[] = [];
  const nights = [];

  for (let n = 1; n <= night; n++) {
    const pool = getShopPool(n);
    const bought: RegularUnitId[] = [];

    if (roster.length < TEAM_SIZE && rng.next() < PURCHASES_PER_NIGHT) {
      const idx = Math.floor(rng.next() * pool.length);
      const id = pool[idx]!;
      bought.push(id);
      roster.push(id);
    }

    nights.push({
      night: n,
      bought,
      sold: [] as RegularUnitId[],
      grafted: [] as { target: RegularUnitId; material: RegularUnitId }[],
      foodPurchases: 0,
      equipPurchases: 0,
      rerolls: 0,
      bloodSpent: 0,
      rosterAtEndOfNight: [...roster],
      offers: [...bought],
      targetOffers: [] as RegularUnitId[],
    });
  }

  return { ids: [...roster], history: { nights } };
}
