import type { BattleResult } from "../../shared/types";
import type { PreparedTrial } from "./sim-ga-types";
import { createSeededRng } from "../rng";
import { generateSimTeam } from "./sim-team-gen";
import { buildProgressedTeam } from "./sim-progression";
import { applySimShopEffects } from "./sim-shop-effects";
import { deriveSeed, makeSimEnemy } from "./sim-utils";

function randomLastBattleResult(seed: number): BattleResult {
  return createSeededRng(seed).next() < 0.5 ? "LOSE" : null;
}

export function prepareTrials(night: number, trials: number, baseSeed: number): PreparedTrial[] {
  const prepared: PreparedTrial[] = [];
  for (let i = 0; i < trials; i++) {
    const enemyRng = createSeededRng(deriveSeed(baseSeed, i));
    const enemyIds = generateSimTeam(night, enemyRng);

    const eRng = createSeededRng(deriveSeed(baseSeed, trials * 2 + i));
    const eTeam = buildProgressedTeam(enemyIds, night, eRng);
    applySimShopEffects(eTeam, night, createSeededRng(deriveSeed(baseSeed, trials * 4 + i)));

    prepared.push({
      enemy: makeSimEnemy(eTeam),
      playerBuildSeed: deriveSeed(baseSeed, trials + i),
      playerShopSeed: deriveSeed(baseSeed, trials * 3 + i),
      battleSeed: deriveSeed(baseSeed, trials * 5 + i),
      lastResult: randomLastBattleResult(deriveSeed(baseSeed, trials * 6 + i)),
    });
  }
  return prepared;
}
