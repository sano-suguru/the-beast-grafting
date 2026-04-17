import type { UnitInstance } from "../../shared/types";
import type { Tier } from "../../shared/data/tiers";
import type { Rng } from "../rng";
import { atLevel } from "../../shared/skill-params";
import { BONE_TREE, GHOUL_INFANT, ROT_RING } from "../../shared/skill-params-shop";
import { invariant } from "../../shared/invariant";
import {
  activeNights,
  estimateWeightedActions,
  distributeTempBuffRandomly,
} from "./sim-shop-effects-util";

/** Night N のショッププール内でTier 1が占める割合 (全Tier 10体ずつ均等) */
function tier1FractionAtNight(night: number): number {
  if (night >= 11) return 1 / 6;
  if (night >= 9) return 1 / 5;
  if (night >= 7) return 1 / 4;
  if (night >= 5) return 1 / 3;
  if (night >= 3) return 1 / 2;
  return 1;
}

export function applyBoneTreeAccumulation(
  boneTree: UnitInstance,
  team: UnitInstance[],
  night: number,
): void {
  const nights = activeNights(boneTree.tier as Tier, night);
  if (nights <= 0) return;

  const buff = atLevel(BONE_TREE.buff, boneTree.level);
  let rawAtk = 0;
  let rawHp = 0;

  for (const action of estimateWeightedActions(boneTree.tier as Tier, night)) {
    rawAtk += buff.atk * action.purchases;
    rawHp += buff.hp * action.purchases;
  }

  const totalAtk = Math.floor(rawAtk);
  const totalHp = Math.floor(rawHp);
  for (const u of team) {
    u.buffAtk += totalAtk;
    u.buffHp += totalHp;
  }
}

export function applyGhoulInfantAccumulation(
  ghoulInfant: UnitInstance,
  team: UnitInstance[],
  night: number,
  rng: Rng,
): void {
  const nights = activeNights(ghoulInfant.tier as Tier, night);
  if (nights <= 0) return;

  const atkBuff = atLevel(GHOUL_INFANT.atkBuff, ghoulInfant.level);
  // tempBuffAtk は夜ごとにリセットされるため、バトル直前の1夜分のみ反映
  const actions = estimateWeightedActions(ghoulInfant.tier as Tier, night);
  const lastNight = actions[actions.length - 1];
  invariant(lastNight, "estimateWeightedActions returned empty for activeNights > 0");
  const totalAtk = Math.floor(atkBuff * lastNight.purchases);
  distributeTempBuffRandomly(team, totalAtk, rng);
}

/**
 * rot_ring: Tier1ユニット購入時に盤面全体へ +buff/+buff（上限: uses回/夜）。
 *
 * maxUses は夜あたり上限（rotRingUses は夜ごとにサーバーでリセット）。
 * Tier1購入頻度 = weighted purchases × tier1FractionAtNight を夜ごとに推定し、
 * 夜ごとに maxUses でキャップしてから累積する。
 */
export function applyRotRingAccumulation(
  rotRing: UnitInstance,
  team: UnitInstance[],
  night: number,
): void {
  const nights = activeNights(rotRing.tier as Tier, night);
  if (nights <= 0) return;

  const maxUses = atLevel(ROT_RING.uses, rotRing.level);
  let potentialTriggers = 0;
  for (const action of estimateWeightedActions(rotRing.tier as Tier, night)) {
    const nightTriggers = action.purchases * tier1FractionAtNight(action.night);
    potentialTriggers += Math.min(nightTriggers, maxUses);
  }

  const buffAtk = Math.floor(potentialTriggers * ROT_RING.buff.atk);
  const buffHp = Math.floor(potentialTriggers * ROT_RING.buff.hp);
  if (buffAtk <= 0 && buffHp <= 0) return;

  for (const u of team) {
    u.buffAtk += buffAtk;
    u.buffHp += buffHp;
  }
}
