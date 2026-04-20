import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, takeDamage, seg, damageAction, skillAction } from "./battle-context";
import { applyOnHitSkills } from "./battle-skills-on-hit";
import { atLevel, NEEDLESHELL_WORM } from "../shared/skill-params";

export function applyNeedleshellWormAfterAttack(
  u: BattleUnit,
  board: BattleUnit[],
  isPlayer: boolean,
  prefix: string,
  ctx: BattleContext,
) {
  const repeatCount = atLevel(NEEDLESHELL_WORM.targets, u.level);
  const dmg = 1;
  for (let t = 0; t < repeatCount; t++) {
    const ally = board.slice(1).find((a) => a.hp > 0);
    if (!ally) break;
    takeDamage(ally, dmg, u.uid);
    pushFrame(
      ctx,
      "skill",
      () => [prefix, seg.u(u.name), "の針が軋み、後方の味方を刺す。", seg.s(`${dmg}ダメージ`)],
      "skill",
      {
        [u.uid]: skillAction(),
        [ally.uid]: damageAction(dmg, u.uid),
      },
    );
    applyOnHitSkills(ally, board, isPlayer, ctx, 0);
  }
}
