import type { UnitId } from "../shared/types";
import type { BoardUnit } from "../shared/board-unit";
import type { Buff } from "../shared/skill-params";
import type { Rng } from "./rng";
import { atLevel, REVENANT } from "../shared/skill-params";
import { ASH_FUNGUS } from "../shared/skill-params-shop";

function buffNAlliesInFront(
  board: (BoardUnit | null)[],
  sourceIdx: number,
  count: number,
  buff: Buff,
): void {
  let buffed = 0;
  for (let i = sourceIdx - 1; i >= 0 && buffed < count; i--) {
    const target = board[i];
    if (!target) continue;
    board[i] = {
      ...target,
      buffAtk: target.buffAtk + buff.atk,
      buffHp: target.buffHp + buff.hp,
    };
    buffed++;
  }
}

export function applyRevenantBuff(board: (BoardUnit | null)[]): void {
  for (let i = 0; i < board.length; i++) {
    const rev = board[i];
    if (!rev || (rev.id as UnitId) !== "revenant") continue;
    const targets = atLevel(REVENANT.targets, rev.level);
    buffNAlliesInFront(board, i, targets, REVENANT.buff);
  }
}

export function applyAshFungusBuff(board: (BoardUnit | null)[], rng: Rng): void {
  for (let i = 0; i < board.length; i++) {
    const u = board[i];
    if (!u || u.id !== "ash_fungus") continue;
    const buff = atLevel(ASH_FUNGUS.buff, u.level);
    const eligible = board
      .map((unit, idx) => ({ unit, idx }))
      .filter(
        (e): e is { unit: BoardUnit; idx: number } =>
          e.unit !== null && e.idx !== i && e.unit.level >= ASH_FUNGUS.minLevel,
      );
    for (let t = 0; t < ASH_FUNGUS.targets && eligible.length > 0; t++) {
      const pick = Math.floor(rng.next() * eligible.length);
      const { unit, idx } = eligible[pick]!;
      board[idx] = { ...unit, buffAtk: unit.buffAtk + buff, buffHp: unit.buffHp + buff };
      eligible.splice(pick, 1);
    }
  }
}
