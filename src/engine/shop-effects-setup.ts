import type { BattleResult, UnitId } from "../shared/types";
import type { BoardUnit } from "../shared/board-unit";
import { atLevel, SNAIL } from "../shared/skill-params";

function buffFrontAllies(board: (BoardUnit | null)[], snail: BoardUnit): void {
  const buff = atLevel(SNAIL.atkBuff, snail.level);
  let buffed = 0;
  for (let i = 0; i < board.length && buffed < SNAIL.targets; i++) {
    const target = board[i];
    if (!target || target.uid === snail.uid) continue;
    board[i] = { ...target, buffAtk: target.buffAtk + buff };
    buffed++;
  }
}

/** Snail (catacomb_rat): ターン開始 – 前回敗北時、前方3体にATKバフ */
export function applySnailBuff(board: (BoardUnit | null)[], lastBattleResult: BattleResult): void {
  if (lastBattleResult !== "LOSE") return;
  const snails = board.filter(
    (u): u is BoardUnit => u !== null && (u.id as UnitId) === "catacomb_rat",
  );
  for (const snail of snails) buffFrontAllies(board, snail);
}
