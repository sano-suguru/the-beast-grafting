import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, getMult, enemyPrefix, seg } from "./battle-context";
import { invariant } from "../shared/invariant";
import {
  getDeathHandler,
  handleEquipDeath,
  handleBeelzebubSpawns,
  handleEvangelistPlague,
} from "./battle-deaths-handlers";
import { DEATH_CASCADE_LIMIT, ALTAR_BUFF, FRAME_DELAY_DEATH_CHAIN } from "./constants";

function applyAltarBuffs(board: BattleUnit[], isPlayer: boolean, ctx: BattleContext) {
  const prefix = enemyPrefix(isPlayer);
  board.forEach((u) => {
    if (u.id !== "token" || u.altarBuffed) return;
    board.forEach((a, aIdx) => {
      if (a.id !== "altar") return;
      const mult = getMult(board, aIdx);
      const atkBuff = ALTAR_BUFF.atk * mult;
      const hpBuff = ALTAR_BUFF.hp * mult;
      u.atk += atkBuff;
      u.hp += hpBuff;
      pushFrame(
        ctx,
        "skill",
        [
          prefix,
          seg.u(a.name),
          "から瘴気が溢れる。",
          seg.u(u.name),
          `の肉が膨れ上がる！ +${atkBuff}/+${hpBuff} → `,
          seg.s(`${u.atk}/${u.hp}`),
        ],
        "skill",
        {
          [u.uid]: { type: "buff", value: `+${atkBuff}/+${hpBuff}` },
        },
        FRAME_DELAY_DEATH_CHAIN,
      );
    });
    u.altarBuffed = true;
  });
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

function executeDeathEffects(
  dead: BattleUnit,
  board: BattleUnit[],
  insertIdx: number,
  mult: number,
  isPlayer: boolean,
  ctx: BattleContext,
) {
  const successor = getSuccessor(board, insertIdx);
  const successor2 = getSuccessor(board, insertIdx + 1);
  const handler = getDeathHandler(dead.id);
  for (let m = 0; m < mult; m++) {
    if (handler) handler({ dead, board, idx: insertIdx, isPlayer, ctx, successor, successor2 });
    handleEquipDeath(dead, board, insertIdx, isPlayer, ctx);
  }
  if (dead.id !== "token") {
    handleBeelzebubSpawns(board, isPlayer, ctx, insertIdx);
  }
  const enemyBoard = isPlayer ? ctx.eBoard : ctx.pBoard;
  handleEvangelistPlague(board, enemyBoard, isPlayer, ctx);
}

function processSideDeaths(board: BattleUnit[], isPlayer: boolean, ctx: BattleContext): boolean {
  const deadUnits = collectDeadUnits(board);
  if (deadUnits.length === 0) return false;

  const bestIdx = selectDeadUnit(deadUnits, ctx.rng.next()).idx;
  const dead = board[bestIdx];
  invariant(dead, "dead unit must exist at bestIdx");
  const mult = getMult(board, bestIdx);

  const prefix = enemyPrefix(isPlayer);
  pushFrame(ctx, "death", [prefix, seg.u(dead.name), " は無残に引き裂かれた。"], "death", {
    [dead.uid]: { type: "death" },
  });

  board.splice(bestIdx, 1);
  executeDeathEffects(dead, board, bestIdx, mult, isPlayer, ctx);
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
