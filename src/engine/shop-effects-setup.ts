import type { BattleResult, UnitId } from "../shared/types";
import type { BoardUnit } from "../shared/board-unit";
import { atLevel, CATACOMB_RAT, REVENANT } from "../shared/skill-params";

function buffFrontAllies(board: (BoardUnit | null)[], source: BoardUnit): void {
  const buff = atLevel(CATACOMB_RAT.atkBuff, source.level);
  let buffed = 0;
  for (let i = 0; i < board.length && buffed < CATACOMB_RAT.targets; i++) {
    const target = board[i];
    if (!target || target.uid === source.uid) continue;
    board[i] = { ...target, buffAtk: target.buffAtk + buff };
    buffed++;
  }
}

/** catacomb_rat: ターン開始 – 前回敗北時、前方3体にATKバフ */
export function applyCatacombRatBuff(
  board: (BoardUnit | null)[],
  lastBattleResult: BattleResult,
): void {
  if (lastBattleResult !== "LOSE") return;
  const rats = board.filter(
    (u): u is BoardUnit => u !== null && (u.id as UnitId) === "catacomb_rat",
  );
  for (const rat of rats) buffFrontAllies(board, rat);
}

/** revenant: ターン開始 – 前方N体に+1/+1 */
export function applyRevenantBuff(board: (BoardUnit | null)[]): void {
  const revenants = board.filter(
    (u): u is BoardUnit => u !== null && (u.id as UnitId) === "revenant",
  );
  for (const rev of revenants) {
    const targets = atLevel(REVENANT.targets, rev.level);
    const b = REVENANT.buff;
    let buffed = 0;
    const idx = board.indexOf(rev);
    for (let i = idx - 1; i >= 0 && buffed < targets; i--) {
      const target = board[i];
      if (!target) continue;
      board[i] = {
        ...target,
        buffAtk: target.buffAtk + b.atk,
        buffHp: target.buffHp + b.hp,
      };
      buffed++;
    }
  }
}
