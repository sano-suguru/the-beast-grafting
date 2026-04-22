import type { BattleUnit, BattleContext } from "./battle-context";
import {
  pushFrame,
  runWithBrainsRepeat,
  getBrainsRepeatLevel,
  enemyPrefix,
  seg,
  buffAction,
  deathAction,
} from "./battle-context";
import { invariant } from "../shared/invariant";
import {
  getDeathHandler,
  handleEquipDeath,
  SPAWN_ALLY_REACTIONS,
  PERSISTENT_ALLY_REACTIONS,
  type AllyReactionCtx,
} from "./battle-deaths-handlers";
import { processAvenge, incrementAvengeCounters } from "./battle-avenge";
import { DEATH_CASCADE_LIMIT, FRAME_DELAY_DEATH_CHAIN } from "./constants";
import { atLevel, PARASITE } from "../shared/skill-params";

function markTokensProcessed(board: BattleUnit[]) {
  for (const u of board) {
    if (u.id === "token") u.spawnProcessed = true;
  }
}

function applyParasiteSummonReaction(board: BattleUnit[], isPlayer: boolean, ctx: BattleContext) {
  const prefix = enemyPrefix(isPlayer);
  for (const token of board) {
    if (token.id !== "token" || token.spawnProcessed) continue;
    for (let pIdx = 0; pIdx < board.length; pIdx++) {
      const p = board[pIdx]!;
      if (p.id !== "parasite" || p.hp <= 0) continue;
      runWithBrainsRepeat(p, board, pIdx, () => {
        const b = atLevel(PARASITE.buff, p.level);
        p.atk += b.atk;
        p.hp += b.hp;
        pushFrame(
          ctx,
          "skill",
          () => [prefix, seg.u(p.name), "が召喚に反応し蠢く！ ", seg.s(`+${b.atk}/+${b.hp}`)],
          "skill",
          { [p.uid]: buffAction({ atk: b.atk, hp: b.hp }, p.uid) },
          FRAME_DELAY_DEATH_CHAIN,
        );
      });
    }
  }
}

function selectDeadUnit(
  deadUnits: { idx: number; unit: BattleUnit }[],
  rngNext: number,
): { idx: number; unit: BattleUnit } {
  const bestAtk = Math.max(...deadUnits.map((d) => d.unit.atk));
  const atkPool = deadUnits.filter((d) => d.unit.atk === bestAtk);
  const bestHp = Math.max(...atkPool.map((d) => d.unit.hp));
  const finalPool = atkPool.filter((d) => d.unit.hp === bestHp);
  const chosen = finalPool[Math.floor(rngNext * finalPool.length)];
  invariant(chosen, "chosen dead unit must exist (finalPool is non-empty)");
  return chosen;
}

function collectDeadUnits(board: BattleUnit[]): { idx: number; unit: BattleUnit }[] {
  const dead: { idx: number; unit: BattleUnit }[] = [];
  for (let i = 0; i < board.length; i++) {
    const unit = board[i]!;
    if (unit.hp <= 0) dead.push({ idx: i, unit });
  }
  return dead;
}

function getSuccessor(board: BattleUnit[], idx: number): BattleUnit | null {
  return idx < board.length ? (board[idx] ?? null) : null;
}

function executeOwnDeathSkills(
  dead: BattleUnit,
  board: BattleUnit[],
  insertIdx: number,
  repeatLevel: number | null,
  isPlayer: boolean,
  ctx: BattleContext,
) {
  const handler = getDeathHandler(dead.id);
  const fire = () => {
    const successor = getSuccessor(board, insertIdx);
    const successor2 = getSuccessor(board, insertIdx + 1);
    if (handler) handler({ dead, board, idx: insertIdx, isPlayer, ctx, successor, successor2 });
  };
  fire();
  if (repeatLevel !== null) {
    const origLevel = dead.level;
    dead.level = repeatLevel;
    fire();
    dead.level = origLevel;
  }
  handleEquipDeath(dead, board, insertIdx, isPlayer, ctx);
}

function executeAllyReactions(
  dead: BattleUnit,
  board: BattleUnit[],
  deathIdx: number,
  isPlayer: boolean,
  ctx: BattleContext,
) {
  if (dead.id === "token") return;
  const enemyBoard = isPlayer ? ctx.eBoard : ctx.pBoard;
  const r: AllyReactionCtx = { dead, board, enemyBoard, deathIdx, isPlayer, ctx };
  for (const react of SPAWN_ALLY_REACTIONS) react(r);
  for (const react of PERSISTENT_ALLY_REACTIONS) react(r);
}

function executeDeathEffects(
  dead: BattleUnit,
  board: BattleUnit[],
  insertIdx: number,
  repeatLevel: number | null,
  isPlayer: boolean,
  ctx: BattleContext,
) {
  executeOwnDeathSkills(dead, board, insertIdx, repeatLevel, isPlayer, ctx);
  executeAllyReactions(dead, board, insertIdx, isPlayer, ctx);
}

function incrementAndProcessAvenge(isPlayer: boolean, ctx: BattleContext): void {
  const board = isPlayer ? ctx.pBoard : ctx.eBoard;
  incrementAvengeCounters(board);
  processAvenge(board, isPlayer, ctx);
}

function processSideDeaths(board: BattleUnit[], isPlayer: boolean, ctx: BattleContext): boolean {
  const deadUnits = collectDeadUnits(board);
  if (deadUnits.length === 0) return false;

  const bestIdx = selectDeadUnit(deadUnits, ctx.rng.next()).idx;
  const dead = board[bestIdx];
  invariant(dead, "dead unit must exist at bestIdx");
  // brains の再発動レベルは splice 前に捕捉する必要がある(splice後は並び順が変わる)
  const repeatLevel = getBrainsRepeatLevel(board, bestIdx);

  const prefix = enemyPrefix(isPlayer);
  pushFrame(ctx, "death", () => [prefix, seg.u(dead.name), " は無残に引き裂かれた。"], "death", {
    [dead.uid]: deathAction(dead.lastDamageSource ?? undefined),
  });

  board.splice(bestIdx, 1);
  executeDeathEffects(dead, board, bestIdx, repeatLevel, isPlayer, ctx);

  // トークン（スポーンユニット）の死亡ではavengeカウンタを加算しない。
  // 実ユニットの死亡のみがavengeを起動し、正帰還ループを防ぐ。
  if (dead.id !== "token") {
    incrementAndProcessAvenge(isPlayer, ctx);
  }

  return true;
}

export function resolveDeaths(ctx: BattleContext) {
  let loopSafety = 0;
  let deathOccurred = true;

  while (deathOccurred && loopSafety < DEATH_CASCADE_LIMIT) {
    deathOccurred = false;
    loopSafety++;

    if (processSideDeaths(ctx.pBoard, true, ctx)) {
      deathOccurred = true;
    }
    if (processSideDeaths(ctx.eBoard, false, ctx)) {
      deathOccurred = true;
    }

    applyParasiteSummonReaction(ctx.pBoard, true, ctx);
    applyParasiteSummonReaction(ctx.eBoard, false, ctx);
    markTokensProcessed(ctx.pBoard);
    markTokensProcessed(ctx.eBoard);
  }
}
