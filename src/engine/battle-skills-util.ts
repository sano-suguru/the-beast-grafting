import type { LogSegment } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, takeDamage, enemyPrefix } from "./battle-context";
import { resolveDeaths } from "./battle-deaths";

export type SkillContext = {
  u: BattleUnit;
  targetArr: BattleUnit[];
  isPlayer: boolean;
  ctx: BattleContext;
};

export type BeforeAttackArgs = {
  u: BattleUnit;
  board: BattleUnit[];
  enemyBoard: BattleUnit[];
  prefix: string;
  ctx: BattleContext;
};

export function applySkillDamage(
  u: BattleUnit,
  target: BattleUnit,
  dmg: number,
  segments: LogSegment[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  takeDamage(target, dmg);
  const prefix = enemyPrefix(isPlayer);
  pushFrame(ctx, "skill", [prefix, ...segments], "skill", {
    [u.uid]: { type: "skill" },
    [target.uid]: { type: "damage", value: `-${dmg}`, source: u.uid },
  });
  resolveDeaths(ctx);
}
