import type { DeathContext } from "./battle-deaths-handlers-unit";
import { pushFrame, takeDamage, enemyPrefix, seg, aoeDamageActions } from "./battle-context";
import { FRAME_DELAY_DEATH_CHAIN } from "./constants";
import { atLevel, CHOLERA } from "../shared/skill-params";

/** cholera: Faint – 場の全ペット（味方含む）にダメージ */
export function handleCholeraDeath({ dead, board, isPlayer, ctx }: DeathContext) {
  const dmg = atLevel(CHOLERA.damage, dead.level);
  const prefix = enemyPrefix(isPlayer);
  const enemyBoard = isPlayer ? ctx.eBoard : ctx.pBoard;
  const allUnits = [...board, ...enemyBoard].filter((u) => u.hp > 0);
  for (const target of allUnits) {
    takeDamage(target, dmg, dead.uid);
  }
  pushFrame(
    ctx,
    "skill",
    () => [prefix, seg.u(dead.name), "が弾ける！ 全体に", seg.s(`${dmg}ダメージ`)],
    "skill",
    aoeDamageActions(dead, allUnits, dmg),
    FRAME_DELAY_DEATH_CHAIN,
  );
}
