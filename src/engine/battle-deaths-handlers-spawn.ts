import type { LogSegment, DataUnitId } from "../shared/types";
import type { DeathContext } from "./battle-deaths-handlers-unit";
import type { AbsorbedData, BattleContext } from "./battle-context";
import {
  pushFrame,
  takeDamage,
  enemyPrefix,
  seg,
  buffAction,
  skillAction,
  damageAction,
} from "./battle-context";
import { FRAME_DELAY_DEATH_CHAIN, MAX_BOARD_SIZE } from "./constants";
import { spawnTokenAndNotify, spawnSummonedUnitAndNotify } from "./battle-spawn";
import { lookupUnitData } from "../shared/data/unit-lookup";
import { invariant, mustGet } from "../shared/invariant";
import {
  atLevel,
  OMEN_WOMB,
  STELLAR_COCOON,
  BUDDING_HYDRA,
  DEVOURING_GRAFT,
} from "../shared/skill-params";
import { SPAWN_ONLY_UNITS } from "../shared/data/spawn-only-units";

export function handleGraftScionDeath({ dead, isPlayer, ctx, successor }: DeathContext) {
  if (!successor) return;
  successor.atk += dead.atk;
  pushFrame(
    ctx,
    "skill",
    () => [
      enemyPrefix(isPlayer),
      seg.u(dead.name),
      "の筋繊維が",
      seg.u(successor.name),
      "に食い込む！ ",
      seg.s(`+${dead.atk}/+0`),
    ],
    "skill",
    { [successor.uid]: buffAction({ atk: dead.atk, hp: 0 }, dead.uid) },
    FRAME_DELAY_DEATH_CHAIN,
  );
}

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
  const t = atLevel(STELLAR_COCOON.summon, dead.level);
  const stat = `${t.atk}/${t.hp}`;
  const segments = () => [
    enemyPrefix(isPlayer),
    seg.u(dead.name),
    "の殻が砕ける。中から何かが…… ",
    seg.s(`${stat} 召喚`),
  ];
  spawnSummonedUnitAndNotify({
    board,
    idx,
    unitData: SPAWN_ONLY_UNITS.star_child,
    atk: t.atk,
    hp: t.hp,
    isChurch: dead.isChurch,
    level: dead.level,
    segments,
    isPlayer,
    ctx,
    delay: FRAME_DELAY_DEATH_CHAIN,
    spawnerUid: dead.uid,
  });
}

export function handleStarChildDeath({ dead, isPlayer, ctx }: DeathContext) {
  const killerUid = dead.lastDamageSource;
  if (!killerUid) return;

  const killerBoard = isPlayer ? ctx.eBoard : ctx.pBoard;
  const killer = killerBoard.find((u) => u.uid === killerUid && u.hp > 0);
  if (!killer) return;

  const allies = killerBoard.filter((u) => u.uid !== killer.uid && u.hp > 0);
  if (allies.length === 0) return;

  const target = mustGet(allies, Math.floor(ctx.rng.next() * allies.length), "frenzy target");
  takeDamage(target, killer.atk, killer.uid);
  pushFrame(
    ctx,
    "skill",
    () => [
      enemyPrefix(!isPlayer),
      seg.u(killer.name),
      "が正気を失い、",
      seg.u(target.name),
      "に襲いかかる！ ",
      seg.s(`${killer.atk}ダメージ`),
    ],
    "skill",
    { [killer.uid]: skillAction(), [target.uid]: damageAction(killer.atk) },
    FRAME_DELAY_DEATH_CHAIN,
  );
}

export function handleDevouringGraftDeath({ dead, board, idx, isPlayer, ctx }: DeathContext) {
  const absorbed = ctx.absorbedUnits.get(dead.uid);
  if (!absorbed) return;
  ctx.absorbedUnits.delete(dead.uid);
  const prefix = enemyPrefix(isPlayer);
  const decay = DEVOURING_GRAFT.decayPercent / 100;
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
