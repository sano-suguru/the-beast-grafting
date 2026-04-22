import type { DeathContext } from "./battle-deaths-handlers-unit";
import { pushFrame, takeDamage, enemyPrefix, seg, aoeDamageActions } from "./battle-context";
import { FRAME_DELAY_DEATH_CHAIN } from "./constants";
import { atLevel, CHOLERA, SPITE_BEAST } from "../shared/skill-params";

/** spite_beast: Faint – 後方味方と敵最前衛に攻撃のN%ダメージ */
export function handleSpiteBeastDeath({ dead, board, idx, isPlayer, ctx }: DeathContext) {
  const pct = atLevel(SPITE_BEAST.percent, dead.level);
  const dmg = Math.floor((dead.atk * pct) / 100);
  if (dmg <= 0) return;
  const prefix = enemyPrefix(isPlayer);
  const enemyBoard = isPlayer ? ctx.eBoard : ctx.pBoard;
  const targets = [];
  const behind = board[idx];
  if (behind && behind.hp > 0) targets.push(behind);
  const enemyFront = enemyBoard[0];
  if (enemyFront && enemyFront.hp > 0) targets.push(enemyFront);
  if (targets.length === 0) return;
  const snapped = targets.map((t) => ({ unit: t, hp: t.hp }));
  for (const t of targets) takeDamage(t, dmg, ctx, dead.uid);
  pushFrame(
    ctx,
    "skill",
    () => [
      prefix,
      seg.u(dead.name),
      "の顎が、最後に閉じた。",
      ...snapped.flatMap(({ unit, hp }) => [
        " ",
        seg.u(unit.name),
        seg.hp(`${hp}→${Math.max(0, hp - dmg)}`),
      ]),
    ],
    "skill",
    aoeDamageActions(dead, targets, dmg),
    FRAME_DELAY_DEATH_CHAIN,
  );
}

export function handleCholeraDeath({ dead, board, isPlayer, ctx }: DeathContext) {
  const dmg = atLevel(CHOLERA.damage, dead.level);
  const prefix = enemyPrefix(isPlayer);
  const enemyBoard = isPlayer ? ctx.eBoard : ctx.pBoard;
  const allUnits = [...board, ...enemyBoard].filter((u) => u.hp > 0);
  for (const target of allUnits) {
    takeDamage(target, dmg, ctx, dead.uid);
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
