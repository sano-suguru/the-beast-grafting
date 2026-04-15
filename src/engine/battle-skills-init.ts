import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, enemyPrefix, seg, buffAction, skillAction } from "./battle-context";
import { atLevel, BLOOD_FONT } from "../shared/skill-params";

type DeployHandler = (board: BattleUnit[], isPlayer: boolean, ctx: BattleContext) => void;

function applyBloodFontBuffs(board: BattleUnit[], isPlayer: boolean, ctx: BattleContext) {
  for (const u of board) {
    if (u.id !== "blood_font" || u.hp <= 0) continue;
    let minHp = Infinity;
    let target: BattleUnit | null = null;
    for (const ally of board) {
      if (ally === u || ally.hp <= 0) continue;
      if (ally.hp < minHp) {
        minHp = ally.hp;
        target = ally;
      }
    }
    if (!target) continue;
    const hpBuff = atLevel(BLOOD_FONT.hpBuff, u.level);
    target.hp += hpBuff;
    pushFrame(
      ctx,
      "skill",
      [
        enemyPrefix(isPlayer),
        seg.u(u.name),
        "の血が凝り、",
        seg.u(target.name),
        "の傷口を塗り固める。",
        seg.s(`+0/+${hpBuff}`),
      ],
      "skill",
      {
        [u.uid]: skillAction(),
        [target.uid]: buffAction({ atk: 0, hp: hpBuff }, u.uid),
      },
    );
  }
}

/** 出陣時スキル: 開戦スキルより前に実行される。配列順が実行順を決定する */
const DEPLOY_HANDLERS: DeployHandler[] = [applyBloodFontBuffs];

export function runDeploySkills(board: BattleUnit[], isPlayer: boolean, ctx: BattleContext) {
  for (const handler of DEPLOY_HANDLERS) {
    handler(board, isPlayer, ctx);
  }
}
