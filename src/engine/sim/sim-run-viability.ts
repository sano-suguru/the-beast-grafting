import type { RegularUnitId } from "../../shared/types";
import { getShopPool, shuffleAndTakeN } from "../helpers";
import { lookupUnitData } from "../../shared/data/unit-lookup";
import { invariant } from "../../shared/invariant";
import { createSeededRng, type Rng } from "../rng";
import { getShopSize } from "../shop-generation";
import { buildProgressedTeam } from "./sim-progression";
import { computeReachabilityScore } from "./sim-reachability";
import { estimateTeamWinRate } from "./sim-shop-targeting";
import type { TeamViability } from "./sim-types";
import { TEAM_SIZE, TIER_APPEAR_NIGHT } from "./sim-types";
import { deriveSeed } from "./sim-utils";

const DEFAULT_SAMPLES = 12;
const SHOP_VIEWS_PER_NIGHT = 4;
const LIFE_TOTAL = 5;

interface NightState {
  purchases: number;
  rerolls: number;
  bloodSpent: number;
  foodPurchases: number;
  equipPurchases: number;
  soldCount: number;
}

interface SampleAccumulator {
  readonly nightlyLifeSpent: number[];
  arrivalNight: number | null;
  stabilizeNight: number | null;
  pivotRisk: number;
  economyPressure: number;
  supportObserved: number;
  supportMissing: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getRegularUnitMeta(id: RegularUnitId) {
  const unit = lookupUnitData(id);
  invariant(unit, `unknown RegularUnitId in sim-run-viability: ${id}`);
  return unit;
}

function purchaseBudgetAt(night: number): number {
  if (night >= 11) return 3;
  if (night >= 5) return 2;
  return 1;
}

function rerollBudgetAt(night: number): number {
  if (night >= 11) return 3;
  if (night >= 5) return 2;
  return 1;
}

function lifeLossAt(night: number): number {
  if (night >= 11) return 1.1;
  if (night >= 7) return 1;
  return 0.85;
}

function desiredCopiesFor(id: RegularUnitId, battleNight: number): number {
  const tier = getRegularUnitMeta(id).tier as keyof typeof TIER_APPEAR_NIGHT;
  const ownable = Math.max(1, battleNight - TIER_APPEAR_NIGHT[tier] + 1);
  if (ownable >= 7) return 2;
  if (ownable >= 4) return 1.5;
  return 1;
}

function expectedArrivalNight(ids: readonly RegularUnitId[], battleNight: number): number {
  const latestAppear = ids.reduce((max, id) => {
    const tier = getRegularUnitMeta(id).tier as keyof typeof TIER_APPEAR_NIGHT;
    return Math.max(max, TIER_APPEAR_NIGHT[tier]);
  }, 1);
  const lateTierCount = ids.reduce(
    (sum, id) => sum + (getRegularUnitMeta(id).tier >= 5 ? 1 : 0),
    0,
  );
  return Math.min(battleNight, latestAppear + 1 + Math.floor(lateTierCount / 2));
}

function fillerScore(id: RegularUnitId): number {
  const unit = getRegularUnitMeta(id);
  return unit.baseAtk * 1.2 + unit.baseHp + unit.tier * 2;
}

function targetOfferScore(
  id: RegularUnitId,
  night: number,
  battleNight: number,
  ownedCopies: number,
  inRoster: boolean,
): number {
  const unit = getRegularUnitMeta(id);
  const timeLeft = Math.max(1, battleNight - night + 1);
  const desiredCopies = desiredCopiesFor(id, battleNight);
  const missingCopyDebt = Math.max(0, desiredCopies - ownedCopies);
  const urgency = (unit.tier * 4 + missingCopyDebt * 12) / timeLeft;
  return (inRoster ? 60 : 100) + urgency;
}

function duplicateCoverage(
  targetIds: readonly RegularUnitId[],
  ownedCopies: ReadonlyMap<RegularUnitId, number>,
  battleNight: number,
): number {
  let desiredTotal = 0;
  let progressTotal = 0;
  for (const id of targetIds) {
    const desired = desiredCopiesFor(id, battleNight);
    desiredTotal += desired;
    progressTotal += Math.min(desired, ownedCopies.get(id) ?? 0);
  }
  return desiredTotal > 0 ? progressTotal / desiredTotal : 1;
}

function createNightState(night: number): NightState {
  return {
    purchases: purchaseBudgetAt(night),
    rerolls: 0,
    bloodSpent: 0,
    foodPurchases: 0,
    equipPurchases: 0,
    soldCount: 0,
  };
}

function selectReplaceIndex(
  roster: readonly RegularUnitId[],
  targetSet: ReadonlySet<RegularUnitId>,
): number {
  let bestIndex = -1;
  let bestScore = Infinity;
  for (let i = 0; i < roster.length; i++) {
    const id = roster[i]!;
    if (targetSet.has(id)) continue;
    const score = fillerScore(id);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function pickOffer(
  shown: readonly RegularUnitId[],
  roster: readonly RegularUnitId[],
  targetSet: ReadonlySet<RegularUnitId>,
  copyCounts: ReadonlyMap<RegularUnitId, number>,
  night: number,
  battleNight: number,
): RegularUnitId | null {
  const rosterSet = new Set(roster);
  const missingTargets = shown
    .filter((id) => targetSet.has(id) && !rosterSet.has(id))
    .sort(
      (a, b) =>
        targetOfferScore(b, night, battleNight, copyCounts.get(b) ?? 0, false) -
        targetOfferScore(a, night, battleNight, copyCounts.get(a) ?? 0, false),
    );
  if (missingTargets.length > 0) return missingTargets[0]!;

  const duplicateTargets = shown
    .filter((id) => targetSet.has(id) && rosterSet.has(id))
    .sort(
      (a, b) =>
        targetOfferScore(b, night, battleNight, copyCounts.get(b) ?? 0, true) -
        targetOfferScore(a, night, battleNight, copyCounts.get(a) ?? 0, true),
    );
  if (duplicateTargets.length > 0) return duplicateTargets[0]!;

  const fillers = shown
    .filter((id) => !targetSet.has(id) && !rosterSet.has(id))
    .sort((a, b) => fillerScore(b) - fillerScore(a));
  return fillers[0] ?? null;
}

function buyTarget(
  picked: RegularUnitId,
  roster: RegularUnitId[],
  targetSet: ReadonlySet<RegularUnitId>,
  copyCounts: Map<RegularUnitId, number>,
  state: NightState,
  accumulator: SampleAccumulator,
): void {
  const inRoster = roster.includes(picked);
  copyCounts.set(picked, (copyCounts.get(picked) ?? 0) + 1);
  state.purchases--;
  state.bloodSpent += 3;
  if (inRoster) return;
  if (roster.length < TEAM_SIZE) {
    roster.push(picked);
    return;
  }
  const replaceIndex = selectReplaceIndex(roster, targetSet);
  if (replaceIndex >= 0) {
    state.soldCount++;
    roster[replaceIndex] = picked;
    return;
  }
  accumulator.economyPressure += 0.4;
}

function buyFiller(picked: RegularUnitId, roster: RegularUnitId[], state: NightState): void {
  if (roster.length >= TEAM_SIZE) return;
  roster.push(picked);
  state.purchases--;
  state.bloodSpent += 3;
}

function applyShopView(
  night: number,
  battleNight: number,
  rng: Rng,
  roster: RegularUnitId[],
  targetIds: readonly RegularUnitId[],
  copyCounts: Map<RegularUnitId, number>,
  state: NightState,
  accumulator: SampleAccumulator,
): void {
  if (state.purchases <= 0) return;
  const targetSet = new Set(targetIds);
  const shown = shuffleAndTakeN(getShopPool(night), getShopSize(night), rng);
  const picked = pickOffer(shown, roster, targetSet, copyCounts, night, battleNight);
  if (!picked) return;
  if (targetSet.has(picked)) buyTarget(picked, roster, targetSet, copyCounts, state, accumulator);
  else buyFiller(picked, roster, state);
}

function applyItemCompetition(
  night: number,
  rng: Rng,
  targetCoverage: number,
  state: NightState,
): void {
  if (night < 7 || state.purchases <= 0 || targetCoverage < 0.4) return;
  const itemBuys = state.purchases > 1 || rng.next() < 0.35 ? 1 : 0;
  if (itemBuys === 0) return;
  if (rng.next() < 0.65) state.foodPurchases = itemBuys;
  else state.equipPurchases = itemBuys;
  state.bloodSpent += itemBuys * 3;
  state.purchases -= itemBuys;
}

function updateSupportGap(
  roster: readonly RegularUnitId[],
  keyPair: readonly [RegularUnitId, RegularUnitId] | null,
  accumulator: SampleAccumulator,
): void {
  if (!keyPair) return;
  const rosterSet = new Set(roster);
  const hasA = rosterSet.has(keyPair[0]);
  const hasB = rosterSet.has(keyPair[1]);
  if (!hasA && !hasB) return;
  accumulator.supportObserved++;
  if (hasA !== hasB) accumulator.supportMissing++;
}

function estimateNightOutcome(
  roster: readonly RegularUnitId[],
  night: number,
  baseSeed: number,
): number {
  if (roster.length === 0) return 0;
  const tempTeam = buildProgressedTeam(
    roster,
    night,
    createSeededRng(deriveSeed(baseSeed, night * 10_000)),
  );
  return estimateTeamWinRate(tempTeam, night);
}

function updateRunState(
  night: number,
  battleNight: number,
  targetIds: readonly RegularUnitId[],
  roster: readonly RegularUnitId[],
  copyCounts: ReadonlyMap<RegularUnitId, number>,
  state: NightState,
  accumulator: SampleAccumulator,
  baseSeed: number,
): void {
  const targetCoverage = roster.filter((id) => targetIds.includes(id)).length / TEAM_SIZE;
  const dupCoverage = duplicateCoverage(targetIds, copyCounts, battleNight);
  applyItemCompetition(
    night,
    createSeededRng(deriveSeed(baseSeed, night * 20_000)),
    targetCoverage,
    state,
  );
  const nightWinRate = estimateNightOutcome(roster, night, baseSeed);
  accumulator.nightlyLifeSpent.push((1 - nightWinRate) * lifeLossAt(night));
  if (accumulator.arrivalNight === null && targetCoverage === 1) accumulator.arrivalNight = night;
  if (accumulator.stabilizeNight === null && targetCoverage === 1) {
    const stability = targetCoverage * 0.65 + dupCoverage * 0.2 + nightWinRate * 0.15;
    if (stability >= 0.85) accumulator.stabilizeNight = night;
  }
  accumulator.pivotRisk += state.soldCount * 0.25 + (1 - targetCoverage) * (1 - nightWinRate);
  accumulator.economyPressure +=
    state.rerolls * 0.08 +
    (state.foodPurchases + state.equipPurchases) * 0.12 +
    Math.max(0, 1 - dupCoverage) * 0.15;
}

function simulateTargetTeamHistory(
  targetIds: readonly RegularUnitId[],
  battleNight: number,
  baseSeed: number,
  keyPair: readonly [RegularUnitId, RegularUnitId] | null,
): { viability: TeamViability; completedByBattleNight: boolean } {
  const rng = createSeededRng(baseSeed);
  const roster: RegularUnitId[] = [];
  const copyCounts = new Map<RegularUnitId, number>();
  const accumulator: SampleAccumulator = {
    nightlyLifeSpent: [],
    arrivalNight: null,
    stabilizeNight: null,
    pivotRisk: 0,
    economyPressure: 0,
    supportObserved: 0,
    supportMissing: 0,
  };

  for (let night = 1; night <= battleNight; night++) {
    const state = createNightState(night);
    const views = Math.min(SHOP_VIEWS_PER_NIGHT, 1 + rerollBudgetAt(night));
    for (let view = 0; view < views; view++) {
      applyShopView(night, battleNight, rng, roster, targetIds, copyCounts, state, accumulator);
      if (view < views - 1) {
        state.rerolls++;
        state.bloodSpent += 1;
      }
    }
    updateSupportGap(roster, keyPair, accumulator);
    updateRunState(night, battleNight, targetIds, roster, copyCounts, state, accumulator, baseSeed);
  }

  const arrivalNight = accumulator.arrivalNight ?? battleNight + 2;
  const stabilizeNight = Math.max(arrivalNight, accumulator.stabilizeNight ?? battleNight + 2);
  const lifeSpentBeforeStabilize = accumulator.nightlyLifeSpent
    .slice(0, Math.min(stabilizeNight, accumulator.nightlyLifeSpent.length))
    .reduce((sum, value) => sum + value, 0);

  return {
    viability: {
      arrivalNight,
      stabilizeNight,
      lifeSpentBeforeStabilize,
      pivotRiskScore: clamp01(accumulator.pivotRisk / Math.max(1, battleNight * 0.9)),
      economyPressureScore: clamp01(accumulator.economyPressure / Math.max(1, battleNight * 0.8)),
      correlatedReachabilityScore: accumulator.arrivalNight !== null ? 1 : 0,
      requiredSupportMissingRate:
        accumulator.supportObserved > 0
          ? accumulator.supportMissing / accumulator.supportObserved
          : 0,
      viabilityScore: 0,
    },
    completedByBattleNight: accumulator.arrivalNight !== null,
  };
}

export function adjustFitnessForViability(rawFitness: number, viability: TeamViability): number {
  return rawFitness * (0.45 + viability.viabilityScore * 0.55);
}

export function estimateTeamViability(
  targetIds: readonly RegularUnitId[],
  battleNight: number,
  baseSeed: number,
  options?: {
    readonly keyPair?: readonly [RegularUnitId, RegularUnitId] | null;
    readonly samples?: number;
  },
): TeamViability {
  const samples = options?.samples ?? DEFAULT_SAMPLES;
  const keyPair = options?.keyPair ?? null;
  const independentReachability = computeReachabilityScore(targetIds, battleNight);
  let arrivalNight = 0;
  let stabilizeNight = 0;
  let lifeSpentBeforeStabilize = 0;
  let pivotRiskScore = 0;
  let economyPressureScore = 0;
  let correlatedReachabilityScore = 0;
  let requiredSupportMissingRate = 0;

  for (let sample = 0; sample < samples; sample++) {
    const result = simulateTargetTeamHistory(
      targetIds,
      battleNight,
      deriveSeed(baseSeed, sample + 1),
      keyPair,
    );
    const metrics = result.viability;
    arrivalNight += metrics.arrivalNight;
    stabilizeNight += metrics.stabilizeNight;
    lifeSpentBeforeStabilize += metrics.lifeSpentBeforeStabilize;
    pivotRiskScore += metrics.pivotRiskScore;
    economyPressureScore += metrics.economyPressureScore;
    requiredSupportMissingRate += metrics.requiredSupportMissingRate;
    if (result.completedByBattleNight) correlatedReachabilityScore += 1;
  }

  const averaged: TeamViability = {
    arrivalNight: arrivalNight / samples,
    stabilizeNight: stabilizeNight / samples,
    lifeSpentBeforeStabilize: lifeSpentBeforeStabilize / samples,
    pivotRiskScore: pivotRiskScore / samples,
    economyPressureScore: economyPressureScore / samples,
    correlatedReachabilityScore: Math.min(
      independentReachability,
      (independentReachability + correlatedReachabilityScore / samples) / 2,
    ),
    requiredSupportMissingRate: requiredSupportMissingRate / samples,
    viabilityScore: 0,
  };

  const arrivalPenalty = clamp01(
    (averaged.arrivalNight - expectedArrivalNight(targetIds, battleNight)) /
      Math.max(1, battleNight / 2),
  );
  const stabilizePenalty = clamp01(
    (averaged.stabilizeNight - averaged.arrivalNight) / Math.max(1, battleNight / 4),
  );
  const lifePenalty = clamp01(averaged.lifeSpentBeforeStabilize / LIFE_TOTAL);

  return {
    ...averaged,
    viabilityScore: clamp01(
      averaged.correlatedReachabilityScore * 0.35 +
        (1 - arrivalPenalty) * 0.15 +
        (1 - stabilizePenalty) * 0.1 +
        (1 - lifePenalty) * 0.2 +
        (1 - averaged.pivotRiskScore) * 0.1 +
        (1 - averaged.economyPressureScore) * 0.05 +
        (1 - averaged.requiredSupportMissingRate) * 0.05,
    ),
  };
}
