import type { BattleUnit, BattleContext } from "./battle-context";
import { enemyPrefix, seg } from "./battle-context";
import { MAGGOT_TOKEN, DEATH_CURSE_TOKEN, FRAME_DELAY_DEATH_CHAIN } from "./constants";
import { spawnTokenAndNotify } from "./battle-spawn";
import { handleBeelzebubSpawns, handleCathedralSpawns } from "./battle-deaths-effects-reactions";
import {
  handleInsatiableMawBuff,
  handleBoneTreeAllyDeath,
  handleCarrionSentinelAllyDeath,
} from "./battle-deaths-effects-ally-reactions";

function spawnMaggotNest(
  dead: BattleUnit,
  board: BattleUnit[],
  idx: number,
  isPlayer: boolean,
  ctx: BattleContext,
) {
  const prefix = enemyPrefix(isPlayer);
  spawnTokenAndNotify({
    board,
    idx,
    name: "巨大蛆虫",
    atk: MAGGOT_TOKEN.atk,
    hp: MAGGOT_TOKEN.hp,
    isChurch: dead.isChurch,
    segments: () => [prefix, seg.u(dead.name), "の傷口から蛆虫が這い出した！ ", seg.s("1/1 召喚")],
    isPlayer,
    ctx,
    delay: FRAME_DELAY_DEATH_CHAIN,
    spawnerUid: dead.uid,
  });
}

function spawnDeathCurse(
  dead: BattleUnit,
  board: BattleUnit[],
  idx: number,
  isPlayer: boolean,
  ctx: BattleContext,
) {
  const prefix = enemyPrefix(isPlayer);
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

export function handleEquipDeath(
  dead: BattleUnit,
  board: BattleUnit[],
  idx: number,
  isPlayer: boolean,
  ctx: BattleContext,
) {
  if (dead.equip === "maggot") spawnMaggotNest(dead, board, idx, isPlayer, ctx);
  if (dead.equip === "death_curse") spawnDeathCurse(dead, board, idx, isPlayer, ctx);
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
  (r) => handleInsatiableMawBuff(r.board, r.isPlayer, r.ctx),
  (r) => handleBoneTreeAllyDeath(r.board, r.isPlayer, r.ctx),
  (r) => handleCarrionSentinelAllyDeath(r.board, r.deathIdx, r.isPlayer, r.ctx),
];
