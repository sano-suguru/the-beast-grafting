import { parentPort } from "node:worker_threads";
import type { WorkerTask, WorkerResult } from "./sim-ga-types";
import { createSeededRng } from "../rng";
import { buildProgressedUnit } from "./sim-progression";
import { applySimShopEffects } from "./sim-shop-effects";
import { simulateBattleResult } from "./sim-battle";
import { prepareTrials } from "./sim-ga-prepare";

parentPort!.on("message", (task: WorkerTask) => {
  const prepared = prepareTrials(task.night, task.trialCount, task.trialBaseSeed);
  const winRates: number[] = [];
  let totalBattles = 0;
  for (const teamIds of task.teams) {
    let wins = 0;
    for (const t of prepared) {
      const pRng = createSeededRng(t.playerBuildSeed);
      const pTeam = teamIds.map((id) => buildProgressedUnit(id, task.night, pRng));
      applySimShopEffects(pTeam, task.night, createSeededRng(t.playerShopSeed));
      if (simulateBattleResult(pTeam, t.enemy, task.night, t.battleSeed, t.lastResult) === "WIN")
        wins++;
    }
    winRates.push(wins / task.trialCount);
    totalBattles += task.trialCount;
  }
  parentPort!.postMessage({ winRates, battles: totalBattles } satisfies WorkerResult);
});
