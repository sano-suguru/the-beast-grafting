import type { LogSegment, DataUnitId } from "../shared/types";
import type { DeathContext } from "./battle-deaths-handlers-unit";
import type { AbsorbedData, BattleContext } from "./battle-context";
import { enemyPrefix, seg } from "./battle-context";
import { FRAME_DELAY_DEATH_CHAIN, MAX_BOARD_SIZE } from "./constants";
import {
  spawnTokenAndNotify,
  spawnSummonedUnitAndNotify,
  spawnTokenOnEnemyBoard,
} from "./battle-spawn";
import { lookupUnitData } from "../shared/data/unit-lookup";
import { invariant } from "../shared/invariant";
import {
  atLevel,
  OMEN_WOMB,
  STELLAR_COCOON,
  BUDDING_HYDRA,
  DEVOURING_GRAFT,
  DEVOURING_WOUND,
} from "../shared/skill-params";

export function handleOmenWombDeath({ dead, board, idx, isPlayer, ctx }: DeathContext) {
  const t = atLevel(OMEN_WOMB.token, dead.level);
  const prefix = enemyPrefix(isPlayer);
  for (let i = 0; i < 2; i++) {
    spawnTokenAndNotify({
      board,
      idx,
      name: "忌み子",
      atk: t.atk,
      hp: t.hp,
      isChurch: dead.isChurch,
      segments: () => [prefix, seg.u(dead.name), "の腹が裂ける！ ", seg.s(`${t.atk}/${t.hp} 召喚`)],
      isPlayer,
      ctx,
      delay: FRAME_DELAY_DEATH_CHAIN,
      spawnerUid: dead.uid,
    });
  }
}

export function handleStellarCocoonDeath({ dead, board, idx, isPlayer, ctx }: DeathContext) {
  const count = atLevel(STELLAR_COCOON.count, dead.level);
  const spawnAtk = Math.ceil(dead.atk / 2);
  const segments = () => [
    enemyPrefix(isPlayer),
    seg.u(dead.name),
    "の殻が砕ける。中から何かが…… ",
    seg.s(`${spawnAtk}/1 × ${count}`),
  ];
  for (let i = 0; i < count; i++) {
    spawnTokenAndNotify({
      board,
      idx,
      name: "星の落とし子",
      atk: spawnAtk,
      hp: 1,
      isChurch: dead.isChurch,
      segments,
      isPlayer,
      ctx,
      delay: FRAME_DELAY_DEATH_CHAIN,
      spawnerUid: dead.uid,
    });
  }
}

export function handleDevouringGraftDeath({ dead, board, idx, isPlayer, ctx }: DeathContext) {
  const absorbed = ctx.absorbedUnits.get(dead.uid);
  if (!absorbed) return;
  ctx.absorbedUnits.delete(dead.uid);
  const prefix = enemyPrefix(isPlayer);
  const decay = atLevel(DEVOURING_GRAFT.decayPercent, dead.level) / 100;
  const decayedAtk = Math.floor(absorbed.atk * decay);
  const decayedHp = Math.max(1, Math.floor(absorbed.hp * decay));
  const segments = () => [
    prefix,
    seg.u(dead.name),
    "の腹から",
    seg.u(absorbed.name),
    "が這い出した！ ",
    seg.s(`${decayedAtk}/${decayedHp} 召喚`),
  ];
  const spawned =
    absorbed.id === "token"
      ? spawnTokenAndNotify({
          board,
          idx,
          name: absorbed.name,
          atk: decayedAtk,
          hp: decayedHp,
          isChurch: absorbed.isChurch,
          segments,
          isPlayer,
          ctx,
          delay: FRAME_DELAY_DEATH_CHAIN,
          spawnerUid: dead.uid,
        })
      : spawnNamedUnit(
          { ...absorbed, atk: decayedAtk, hp: decayedHp },
          dead,
          board,
          idx,
          segments,
          isPlayer,
          ctx,
        );
  if (spawned && absorbed.equip) spawned.equip = absorbed.equip;
}

function spawnNamedUnit(
  absorbed: AbsorbedData,
  dead: DeathContext["dead"],
  board: DeathContext["board"],
  idx: number,
  segments: () => LogSegment[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  const unitData = lookupUnitData(absorbed.id as DataUnitId);
  invariant(unitData, `unknown absorbed unit id: ${absorbed.id}`);
  return spawnSummonedUnitAndNotify({
    board,
    idx,
    unitData,
    atk: absorbed.atk,
    hp: absorbed.hp,
    isChurch: absorbed.isChurch,
    level: dead.level,
    segments,
    isPlayer,
    ctx,
    delay: FRAME_DELAY_DEATH_CHAIN,
    spawnerUid: dead.uid,
  });
}

export function handleBuddingHydraDeath({ dead, board, idx, isPlayer, ctx }: DeathContext) {
  const divisor = atLevel(BUDDING_HYDRA.divisor, dead.level);
  const count = Math.min(Math.floor(dead.preDeathHp / divisor), MAX_BOARD_SIZE - board.length);
  if (count <= 0) return;
  const t = atLevel(BUDDING_HYDRA.token, dead.level);
  const segments = () => [
    enemyPrefix(isPlayer),
    seg.u(dead.name),
    "の切り口から首が生える！ ",
    seg.s(`${t.atk}/${t.hp} 召喚`),
  ];
  for (let i = 0; i < count; i++) {
    spawnTokenAndNotify({
      board,
      idx,
      name: "ヒドラの首",
      atk: t.atk,
      hp: t.hp,
      isChurch: dead.isChurch,
      segments,
      isPlayer,
      ctx,
      delay: FRAME_DELAY_DEATH_CHAIN,
      spawnerUid: dead.uid,
    });
  }
}

/** devouring_wound: Faint – 敵チーム前方に1/1トークンを召喚 */
export function handleDevouringWoundDeath({ dead, isPlayer, ctx }: DeathContext) {
  const count = atLevel(DEVOURING_WOUND.uses, dead.level);
  const enemyBoard = isPlayer ? ctx.eBoard : ctx.pBoard;
  const prefix = enemyPrefix(isPlayer);
  const { atk, hp } = DEVOURING_WOUND.token;
  for (let i = 0; i < count; i++) {
    spawnTokenOnEnemyBoard({
      enemyBoard,
      name: "汚染された残骸",
      atk,
      hp,
      isChurch: dead.isChurch,
      segments: () => [
        prefix,
        seg.u(dead.name),
        "の肉片が敵陣に飛び散る！ ",
        seg.s(`${atk}/${hp} 召喚`),
      ],
      isPlayer,
      ctx,
      delay: FRAME_DELAY_DEATH_CHAIN,
      spawnerUid: dead.uid,
    });
  }
}
