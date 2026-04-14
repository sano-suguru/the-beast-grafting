import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, enemyPrefix, seg, buffAction, skillAction } from "./battle-context";
import { spawnTokenAndNotify } from "./battle-spawn";
import { atLevel, BLOOD_FONT, CORPSE_GARDEN } from "../shared/skill-params";
import { MAX_BOARD_SIZE } from "./constants";

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

function applyCorpseGardenSpawns(board: BattleUnit[], isPlayer: boolean, ctx: BattleContext) {
  for (let i = 0; i < board.length; i++) {
    const u = board[i]!;
    if (u.id !== "corpse_garden" || u.hp <= 0) continue;
    const b = atLevel(CORPSE_GARDEN.buff, u.level);
    const empty = MAX_BOARD_SIZE - board.length;
    if (empty <= 0) continue;
    for (let s = 0; s < empty; s++) {
      spawnTokenAndNotify({
        board,
        idx: board.length,
        name: "苗床の芽",
        atk: b.atk,
        hp: b.hp,
        isChurch: false,
        segments: [enemyPrefix(isPlayer), seg.u(u.name), "から芽が這い出す。"],
        isPlayer,
        ctx,
        spawnerUid: u.uid,
      });
    }
  }
}

/** 出陣時スキル: 開戦スキルより前に実行される。配列順が実行順を決定する */
const DEPLOY_HANDLERS: DeployHandler[] = [applyCorpseGardenSpawns, applyBloodFontBuffs];

export function runDeploySkills(board: BattleUnit[], isPlayer: boolean, ctx: BattleContext) {
  for (const handler of DEPLOY_HANDLERS) {
    handler(board, isPlayer, ctx);
  }
}
