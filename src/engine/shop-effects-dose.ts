import type { UnitInstance } from "../shared/types";
import type { Rng } from "./rng";
import { atLevel, CORPSE_BROKER, PLAGUE_BELL } from "../shared/skill-params";

interface DoseResult {
  board: (UnitInstance | null)[];
  corpseBrokerUses: number;
}

export function applyCorpseBrokerDoseBuff(
  board: (UnitInstance | null)[],
  targetIndex: number,
  corpseBrokerUses: number,
): DoseResult {
  if (corpseBrokerUses >= CORPSE_BROKER.maxUses) return { board, corpseBrokerUses };

  const target = board[targetIndex];
  if (!target) return { board, corpseBrokerUses };

  let totalHpBuff = 0;
  for (const u of board) {
    if (!u || u.id !== "corpse_broker") continue;
    if (u.uid === target.uid) continue;
    totalHpBuff += atLevel(CORPSE_BROKER.hpBuff, u.level);
  }

  if (totalHpBuff === 0) return { board, corpseBrokerUses };

  const nextBoard = [...board];
  nextBoard[targetIndex] = {
    ...target,
    buffHp: target.buffHp + totalHpBuff,
  };
  return { board: nextBoard, corpseBrokerUses: corpseBrokerUses + 1 };
}

/**
 * plague_bell が自身に薬を投与された時、他のランダム味方 N 体をバフする。
 * SAP Seal パターン（被食者本人がトリガ）準拠。
 */
export function applyPlagueBellDoseBuff(
  board: (UnitInstance | null)[],
  doseTargetIndex: number,
  rng: Rng,
): (UnitInstance | null)[] {
  const bell = board[doseTargetIndex];
  if (!bell || bell.id !== "plague_bell") return board;
  return buffRandomOtherAllies(board, doseTargetIndex, bell.level, rng);
}

function buffRandomOtherAllies(
  board: (UnitInstance | null)[],
  sourceIndex: number,
  sourceLevel: number,
  rng: Rng,
): (UnitInstance | null)[] {
  const otherIndices: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (i === sourceIndex) continue;
    if (board[i] !== null) otherIndices.push(i);
  }
  if (otherIndices.length === 0) return board;

  const pool = [...otherIndices];
  const take = Math.min(PLAGUE_BELL.targets, pool.length);
  const chosen: number[] = [];
  for (let i = 0; i < take; i++) {
    const idx = Math.floor(rng.next() * pool.length);
    chosen.push(pool.splice(idx, 1)[0]!);
  }

  const b = atLevel(PLAGUE_BELL.buff, sourceLevel);
  const nextBoard = [...board];
  for (const i of chosen) {
    const u = nextBoard[i];
    if (!u) continue;
    nextBoard[i] = { ...u, buffAtk: u.buffAtk + b.atk, buffHp: u.buffHp + b.hp };
  }
  return nextBoard;
}
