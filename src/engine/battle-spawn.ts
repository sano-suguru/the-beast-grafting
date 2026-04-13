import type { LogSegment } from "../shared/types";
import type { UnitData } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import {
  createToken,
  createSummonedUnit,
  pushFrame,
  getMult,
  enemyPrefix,
  seg,
} from "./battle-context";
import { applyZealotBuff } from "./battle-deaths-zealot";
import { getInitOverride } from "./battle-init-overrides";
import { MAX_BOARD_SIZE } from "./constants";
import { atLevel, FLESH_GRANULATION } from "../shared/skill-params";

type SpawnBase = {
  board: BattleUnit[];
  idx: number;
  atk: number;
  hp: number;
  isChurch: boolean;
  level?: number | undefined;
  segments: LogSegment[];
  isPlayer: boolean;
  ctx: BattleContext;
  delay?: number | undefined;
};

function finalize(s: SpawnBase, unit: BattleUnit): BattleUnit {
  s.board.splice(s.idx, 0, unit);
  pushFrame(s.ctx, "skill", s.segments, "skill", { [unit.uid]: { type: "summon" } }, s.delay);
  applyZealotBuff(s.board, unit.uid, s.isPlayer, s.ctx);
  applyFleshGranulationBuff(s.board, s.isPlayer, s.ctx);
  return unit;
}

function applyFleshGranulationBuff(
  board: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
): void {
  const prefix = enemyPrefix(isPlayer);
  for (let i = 0; i < board.length; i++) {
    const u = board[i]!;
    if (u.id !== "flesh_granulation" || u.hp <= 0) continue;
    const mult = getMult(board, i);
    for (let m = 0; m < mult; m++) {
      const b = atLevel(FLESH_GRANULATION.buff, u.level);
      const stat = `+${b.atk}/+${b.hp}`;
      u.atk += b.atk;
      u.hp += b.hp;
      pushFrame(
        ctx,
        "skill",
        [prefix, seg.u(u.name), "が脈動し、膨れ上がる。", seg.s(stat)],
        "skill",
        { [u.uid]: { type: "buff", value: stat } },
      );
    }
  }
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
  const unit = createSummonedUnit(s.unitData, s.atk, s.hp, s.isChurch, s.level);
  getInitOverride(unit.id)?.(unit);
  return finalize(s, unit);
}
