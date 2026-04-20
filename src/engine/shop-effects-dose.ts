import type { UnitInstance } from "../shared/types";
import { atLevel, CORPSE_BROKER } from "../shared/skill-params";

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
