import type { LogSegment } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, takeDamage, enemyPrefix, damageAction, skillAction } from "./battle-context";
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
  segments: () => LogSegment[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  takeDamage(target, dmg, u.uid);
  const prefix = enemyPrefix(isPlayer);
  pushFrame(ctx, "skill", () => [prefix, ...segments()], "skill", {
    [u.uid]: skillAction(),
    [target.uid]: damageAction(dmg, u.uid),
  });
  resolveDeaths(ctx);
}
