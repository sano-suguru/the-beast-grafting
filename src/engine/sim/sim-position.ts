import type { RegularUnitId, UnitInstance, EnemyTeam } from "../../shared/types";
import { createSeededRng } from "../rng";
import { simulateBattleResult } from "./sim-battle";
import { generateSimTeam } from "./sim-team-gen";
import { buildProgressedUnit } from "./sim-progression";
import { invariant } from "../../shared/invariant";
import { deriveSeed, makeSimEnemy } from "./sim-utils";

const DEFAULT_TRIALS_PER_PERM = 50;
const DEFAULT_NIGHT = 12;

function* permutations<T>(arr: readonly T[]): Generator<T[]> {
  if (arr.length <= 1) {
    yield [...arr];
    return;
  }
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      yield [arr[i]!, ...perm];
    }
  }
}

function buildTrialPlayerUnits(
  teamIds: readonly RegularUnitId[],
  night: number,
  baseSeed: number,
  trial: number,
): Map<RegularUnitId, UnitInstance> {
  const prebuilt = new Map<RegularUnitId, UnitInstance>();
  for (let u = 0; u < teamIds.length; u++) {
    // 個別RNGでユニットごとのRNG消費量差が他ユニットに波及しない
    const unitRng = createSeededRng(deriveSeed(baseSeed, 1_000_000 + trial * teamIds.length + u));
    prebuilt.set(teamIds[u]!, buildProgressedUnit(teamIds[u]!, night, unitRng));
  }
  return prebuilt;
}

function buildTrialEnemy(night: number, baseSeed: number, trial: number): EnemyTeam {
  const enemyRng = createSeededRng(deriveSeed(baseSeed, 500_000 + trial));
  const enemyIds = generateSimTeam(night, enemyRng);
  const eProgRng = createSeededRng(deriveSeed(baseSeed, 2_000_000 + trial));
  const enemyUnits = enemyIds.map((id) => buildProgressedUnit(id, night, eProgRng));
  return makeSimEnemy(enemyUnits);
}

/**
 * 全 5!=120 順列を試行し、最高勝率の配置を返す。
 *
 * trial単位で先にユニットをビルドし、順列間でステータスを共有することで
 * RNG消費順による汚染を排除する。
 */
export function findOptimalPositioning(
  teamIds: readonly RegularUnitId[],
  night = DEFAULT_NIGHT,
  baseSeed = 1,
  trialsPerPerm = DEFAULT_TRIALS_PER_PERM,
): RegularUnitId[] {
  invariant(teamIds.length > 0 && teamIds.length <= 5, "team size must be 1-5");
  invariant(new Set(teamIds).size === teamIds.length, "duplicate unit IDs");

  const allPerms = [...permutations(teamIds)];
  const wins = Array.from<number>({ length: allPerms.length }).fill(0);

  for (let t = 0; t < trialsPerPerm; t++) {
    const prebuilt = buildTrialPlayerUnits(teamIds, night, baseSeed, t);
    const enemy = buildTrialEnemy(night, baseSeed, t);

    for (let p = 0; p < allPerms.length; p++) {
      const playerUnits = allPerms[p]!.map((id) => prebuilt.get(id)!);
      const trialSeed = deriveSeed(baseSeed, p * trialsPerPerm + t);
      const result = simulateBattleResult(playerUnits, enemy, night, trialSeed);
      if (result === "WIN") wins[p]!++;
    }
  }

  let bestIdx = 0;
  for (let i = 1; i < wins.length; i++) {
    if (wins[i]! > wins[bestIdx]!) bestIdx = i;
  }
  return allPerms[bestIdx]!;
}

interface NamedTeam {
  readonly name: string;
  readonly unitIds: readonly RegularUnitId[];
}

/** 発見されたアーキタイプにブルートフォースポジション最適化を適用して返す */
export function positionArchetypes(
  discovered: readonly NamedTeam[],
  night = DEFAULT_NIGHT,
  baseSeed = 1,
  trialsPerPerm = DEFAULT_TRIALS_PER_PERM,
): ReadonlyMap<string, readonly RegularUnitId[]> {
  const result = new Map<string, readonly RegularUnitId[]>();
  for (let i = 0; i < discovered.length; i++) {
    const arch = discovered[i]!;
    const archSeed = deriveSeed(baseSeed, (i + 1) * 10_000);
    result.set(arch.name, findOptimalPositioning(arch.unitIds, night, archSeed, trialsPerPerm));
  }
  return result;
}
