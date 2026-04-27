import type { BattleResult, UnitInstance } from "../shared/types";
import { atLevel, ALTAR, CATACOMB_RAT, HANGED_MAN } from "../shared/skill-params";

export type EndOfTurnHandler = (
  board: (UnitInstance | null)[],
  sourceIndex: number,
  lastBattleResult: BattleResult,
) => (UnitInstance | null)[] | null;

export const handleAltarEndOfTurn: EndOfTurnHandler = (board, i) => {
  const u = board[i];
  if (!u) return null;
  const hasHighLevelFriend = board.some(
    (other, j) => j !== i && other !== null && other.level >= ALTAR.requiredFriendLevel,
  );
  if (!hasHighLevelFriend) return null;
  const b = atLevel(ALTAR.buff, u.level);
  const next = [...board];
  next[i] = { ...u, buffAtk: u.buffAtk + b.atk, buffHp: u.buffHp + b.hp };
  return next;
};

export const handleHangedManEndOfTurn: EndOfTurnHandler = (board, i) => {
  const hanged = board[i];
  if (!hanged) return null;
  const frontIdx = board.findIndex((u, idx) => u !== null && idx !== i);
  if (frontIdx === -1) return null;
  const front = board[frontIdx];
  if (!front) return null;
  const b = atLevel(HANGED_MAN.buff, hanged.level);
  const next = [...board];
  next[frontIdx] = {
    ...front,
    buffAtk: front.buffAtk + b.atk,
    buffHp: front.buffHp + b.hp,
  };
  return next;
};

export const handleCatacombRatEndOfTurn: EndOfTurnHandler = (board, i, lastBattleResult) => {
  if (lastBattleResult !== "LOSE") return null;
  const rat = board[i];
  if (!rat) return null;
  const buff = atLevel(CATACOMB_RAT.atkBuff, rat.level);
  let buffed = 0;
  let next: (UnitInstance | null)[] | null = null;
  for (let targetIndex = i - 1; targetIndex >= 0 && buffed < CATACOMB_RAT.targets; targetIndex--) {
    const target = board[targetIndex];
    if (!target) continue;
    if (next === null) next = [...board];
    next[targetIndex] = { ...target, buffAtk: target.buffAtk + buff };
    buffed++;
  }
  return next;
};
