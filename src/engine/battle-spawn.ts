import type { LogSegment } from "../shared/types";
import type { UnitData } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import { createToken, createSummonedUnit, pushFrame } from "./battle-context";
import { applyZealotBuff } from "./battle-deaths-zealot";
import { MAX_BOARD_SIZE } from "./constants";

type SpawnBase = {
  board: BattleUnit[];
  idx: number;
  atk: number;
  hp: number;
  isChurch: boolean;
  segments: LogSegment[];
  isPlayer: boolean;
  ctx: BattleContext;
  delay?: number | undefined;
};

function finalize(s: SpawnBase, unit: BattleUnit): BattleUnit {
  s.board.splice(s.idx, 0, unit);
  pushFrame(s.ctx, "skill", s.segments, "skill", { [unit.uid]: { type: "summon" } }, s.delay);
  applyZealotBuff(s.board, unit.uid, s.isPlayer, s.ctx);
  return unit;
}

export function spawnTokenAndNotify(
  board: BattleUnit[],
  idx: number,
  name: string,
  atk: number,
  hp: number,
  isChurch: boolean,
  segments: LogSegment[],
  isPlayer: boolean,
  ctx: BattleContext,
  delay?: number,
): BattleUnit | null {
  if (board.length >= MAX_BOARD_SIZE) return null;
  return finalize(
    { board, idx, atk, hp, isChurch, segments, isPlayer, ctx, delay },
    createToken(name, atk, hp, isChurch),
  );
}

export function spawnSummonedUnitAndNotify(
  s: SpawnBase & { unitData: UnitData },
): BattleUnit | null {
  if (s.board.length >= MAX_BOARD_SIZE) return null;
  return finalize(s, createSummonedUnit(s.unitData, s.atk, s.hp, s.isChurch));
}
