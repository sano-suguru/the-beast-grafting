import type { UnitInstance, EnemyTeam, BattleResult } from "../../shared/types";
import type { BattleUnit } from "../battle-context";
import { initBattleContext, runBattle } from "../battle";
import { createSeededRng } from "../rng";
import type { SimMetricsCollector, SimUnitEntry, SimBattleResult } from "./sim-types";

/** Result-only simulation (no frames, no metrics). For position optimization. */
export function simulateBattleResult(
  playerBoard: (UnitInstance | null)[],
  enemyTeam: EnemyTeam,
  night: number,
  seed: number,
  lastBattleResult: BattleResult = null,
): BattleResult {
  const rng = createSeededRng(seed);
  const ctx = initBattleContext(playerBoard, enemyTeam, lastBattleResult, rng);
  ctx.simMode = true;
  const { result } = runBattle(ctx, enemyTeam, night);
  return result;
}

/** Lightweight simulation that collects action data for metrics extraction. */
export function simulateBattleSim(
  playerBoard: (UnitInstance | null)[],
  enemyTeam: EnemyTeam,
  night: number,
  seed: number,
  lastBattleResult: BattleResult = null,
): SimBattleResult {
  const rng = createSeededRng(seed);
  const ctx = initBattleContext(playerBoard, enemyTeam, lastBattleResult, rng);
  ctx.simMode = true;
  const unitRegistry = new Map<string, SimUnitEntry>();
  for (const u of ctx.pBoard) unitRegistry.set(u.uid, { id: u.id, side: "player" });
  for (const u of ctx.eBoard) unitRegistry.set(u.uid, { id: u.id, side: "enemy" });
  const collector: SimMetricsCollector = { frameActions: [], unitRegistry };
  ctx.simCollector = collector;

  const { result } = runBattle(ctx, enemyTeam, night);

  const sumHp = (board: BattleUnit[]) => board.reduce((s, u) => s + Math.max(u.hp, 0), 0);
  let winnerRemainingHp = 0;
  if (result === "WIN") winnerRemainingHp = sumHp(ctx.pBoard);
  else if (result === "LOSE") winnerRemainingHp = sumHp(ctx.eBoard);

  return {
    result,
    frameCount: ctx.logCounter,
    simFrameActions: collector.frameActions,
    unitRegistry: collector.unitRegistry,
    pSurvivorUids: new Set(ctx.pBoard.map((u) => u.uid)),
    eSurvivorUids: new Set(ctx.eBoard.map((u) => u.uid)),
    winnerRemainingHp,
  };
}
