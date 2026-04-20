import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, takeDamage, seg, aoeDamageActions } from "./battle-context";
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
  const hit: BattleUnit[] = [];
  for (let t = 0; t < repeatCount; t++) {
    const ally = board.slice(1).find((a) => a.hp > 0);
    if (!ally) break;
    takeDamage(ally, dmg, u.uid);
    if (!hit.includes(ally)) hit.push(ally);
  }
  if (hit.length === 0) return;
  pushFrame(
    ctx,
    "skill",
    () => [prefix, seg.u(u.name), "の針が軋み、後方の味方を刺す。", seg.s(`${dmg}ダメージ`)],
    "skill",
    aoeDamageActions(u, hit, dmg),
  );
  for (const ally of hit) {
    applyOnHitSkills(ally, board, isPlayer, ctx, 0);
  }
}
