import type { BattleUnit, BattleContext } from "./battle-context";
import { enemyPrefix, seg } from "./battle-context";
import { MAGGOT_TOKEN, DEATH_CURSE_TOKEN, FRAME_DELAY_DEATH_CHAIN } from "./constants";
import { spawnTokenAndNotify } from "./battle-spawn";
import {
  handleBeelzebubSpawns,
  handleCrowBuffs,
  handleSinEaterAbsorb,
  handleCathedralSpawns,
  handleEvangelistPlague,
} from "./battle-deaths-effects-reactions";
import {
  handleCrawlingCordBuff,
  handleInsatiableMawBuff,
} from "./battle-deaths-effects-ally-reactions";

export function handleEquipDeath(
  dead: BattleUnit,
  board: BattleUnit[],
  idx: number,
  isPlayer: boolean,
  ctx: BattleContext,
) {
  const prefix = enemyPrefix(isPlayer);
  if (dead.equip === "maggot_nest") {
    spawnTokenAndNotify({
      board,
      idx,
      name: "巨大蛆虫",
      atk: MAGGOT_TOKEN.atk,
      hp: MAGGOT_TOKEN.hp,
      isChurch: dead.isChurch,
      segments: () => [
        prefix,
        seg.u(dead.name),
        "の傷口から蛆虫が這い出した！ ",
        seg.s("1/1 召喚"),
      ],
      isPlayer,
      ctx,
      delay: FRAME_DELAY_DEATH_CHAIN,
      spawnerUid: dead.uid,
    });
  }
  if (dead.equip === "death_curse") {
    spawnTokenAndNotify({
      board,
      idx,
      name: dead.name,
      atk: DEATH_CURSE_TOKEN.atk,
      hp: DEATH_CURSE_TOKEN.hp,
      isChurch: dead.isChurch,
      segments: () => [
        prefix,
        seg.u(dead.name),
        "の呪符が光る。怨念が肉体を繋ぎ止める！ ",
        seg.s("1/1 蘇生"),
      ],
      isPlayer,
      ctx,
      delay: FRAME_DELAY_DEATH_CHAIN,
      spawnerUid: dead.uid,
    });
  }
}

export type AllyReactionCtx = {
  dead: BattleUnit;
  board: BattleUnit[];
  enemyBoard: BattleUnit[];
  deathIdx: number;
  isPlayer: boolean;
  ctx: BattleContext;
};

type AllyReaction = (r: AllyReactionCtx) => void;

export const SPAWN_ALLY_REACTIONS: AllyReaction[] = [
  (r) => handleBeelzebubSpawns(r.board, r.isPlayer, r.ctx, r.deathIdx),
  (r) => handleCathedralSpawns(r.board, r.isPlayer, r.ctx, r.deathIdx),
];

export const PERSISTENT_ALLY_REACTIONS: AllyReaction[] = [
  (r) => handleEvangelistPlague(r.board, r.enemyBoard, r.isPlayer, r.ctx),
  (r) => handleCrowBuffs(r.board, r.isPlayer, r.ctx),
  (r) => handleSinEaterAbsorb(r.board, r.dead.atk, r.isPlayer, r.ctx),
  (r) => handleCrawlingCordBuff(r.board, r.isPlayer, r.ctx),
  (r) => handleInsatiableMawBuff(r.board, r.isPlayer, r.ctx),
];
