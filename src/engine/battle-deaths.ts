import type { BattleUnit, BattleContext } from "./battle-context";
import {
  pushFrame,
  getMult,
  getPuppeteerDeathMult,
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
import { atLevel, ALTAR } from "../shared/skill-params";

function buffTokenFromAltar(
  token: BattleUnit,
  altar: BattleUnit,
  altarIdx: number,
  board: BattleUnit[],
  prefix: string,
  ctx: BattleContext,
) {
  const mult = getMult(board, altarIdx);
  const ab = atLevel(ALTAR.buff, altar.level);
  const atkBuff = ab.atk * mult;
  const hpBuff = ab.hp * mult;
  token.atk += atkBuff;
  token.hp += hpBuff;
  pushFrame(
    ctx,
    "skill",
    () => [
      prefix,
      seg.u(altar.name),
      "から瘴気が溢れる。",
      seg.u(token.name),
      "の肉が膨れ上がる！ ",
      seg.s(`+${atkBuff}/+${hpBuff}`),
      " → ",
      seg.s(`${token.atk}/${token.hp}`),
    ],
    "skill",
    {
      [token.uid]: buffAction({ atk: atkBuff, hp: hpBuff }, altar.uid),
    },
    FRAME_DELAY_DEATH_CHAIN,
  );
}

function applyAltarBuffs(board: BattleUnit[], isPlayer: boolean, ctx: BattleContext) {
  const prefix = enemyPrefix(isPlayer);
  for (const token of board) {
    if (token.id !== "token" || token.altarBuffed) continue;
    for (let aIdx = 0; aIdx < board.length; aIdx++) {
      const altar = board[aIdx]!;
      if (altar.id !== "altar") continue;
      buffTokenFromAltar(token, altar, aIdx, board, prefix, ctx);
    }
    token.altarBuffed = true;
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
  unitMult: number,
  equipMult: number,
  isPlayer: boolean,
  ctx: BattleContext,
) {
  const handler = getDeathHandler(dead.id);
  for (let m = 0; m < unitMult; m++) {
    const successor = getSuccessor(board, insertIdx);
    const successor2 = getSuccessor(board, insertIdx + 1);
    if (handler) handler({ dead, board, idx: insertIdx, isPlayer, ctx, successor, successor2 });
  }
  for (let m = 0; m < equipMult; m++) {
    handleEquipDeath(dead, board, insertIdx, isPlayer, ctx);
  }
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
  mult: number,
  deathMult: number,
  isPlayer: boolean,
  ctx: BattleContext,
) {
  executeOwnDeathSkills(dead, board, insertIdx, mult * deathMult, mult, isPlayer, ctx);
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
  const mult = getMult(board, bestIdx);
  const deathMult = getPuppeteerDeathMult(board, bestIdx);

  const prefix = enemyPrefix(isPlayer);
  pushFrame(ctx, "death", () => [prefix, seg.u(dead.name), " は無残に引き裂かれた。"], "death", {
    [dead.uid]: deathAction(dead.lastDamageSource ?? undefined),
  });

  board.splice(bestIdx, 1);
  executeDeathEffects(dead, board, bestIdx, mult, deathMult, isPlayer, ctx);

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

    applyAltarBuffs(ctx.pBoard, true, ctx);
    applyAltarBuffs(ctx.eBoard, false, ctx);
  }
}
