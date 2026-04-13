import type { LogSegment, DataUnitId } from "../shared/types";
import type { DeathContext } from "./battle-deaths-handlers-unit";
import type { AbsorbedData, BattleContext } from "./battle-context";
import { pushFrame, enemyPrefix, seg } from "./battle-context";
import { FRAME_DELAY_DEATH_CHAIN } from "./constants";
import { spawnTokenAndNotify, spawnSummonedUnitAndNotify } from "./battle-spawn";
import { lookupUnitData } from "../shared/data/unit-lookup";
import { invariant } from "../shared/invariant";
import { atLevel, OMEN_WOMB, STELLAR_COCOON } from "../shared/skill-params";

export function handleGraftScionDeath({ dead, isPlayer, ctx, successor }: DeathContext) {
  if (!successor) return;
  successor.atk += dead.atk;
  pushFrame(
    ctx,
    "skill",
    [
      enemyPrefix(isPlayer),
      seg.u(dead.name),
      "の筋繊維が",
      seg.u(successor.name),
      "に食い込む！ ",
      seg.s(`+${dead.atk}/+0`),
    ],
    "skill",
    { [successor.uid]: { type: "buff", value: `+${dead.atk}/+0` } },
    FRAME_DELAY_DEATH_CHAIN,
  );
}

export function handleOmenWombDeath({ dead, board, idx, isPlayer, ctx }: DeathContext) {
  const t = atLevel(OMEN_WOMB.token, dead.level);
  const prefix = enemyPrefix(isPlayer);
  for (let i = 0; i < 2; i++) {
    spawnTokenAndNotify(
      board,
      idx,
      "忌み子",
      t.atk,
      t.hp,
      dead.isChurch,
      [prefix, seg.u(dead.name), "の腹が裂ける！ ", seg.s(`${t.atk}/${t.hp} 召喚`)],
      isPlayer,
      ctx,
      FRAME_DELAY_DEATH_CHAIN,
    );
  }
}

export function handleStellarCocoonDeath({ dead, board, idx, isPlayer, ctx }: DeathContext) {
  const t = atLevel(STELLAR_COCOON.token, dead.level);
  spawnTokenAndNotify(
    board,
    idx,
    "星の落とし子",
    t.atk,
    t.hp,
    dead.isChurch,
    [
      enemyPrefix(isPlayer),
      seg.u(dead.name),
      "の殻が砕ける。中から何かが…… ",
      seg.s(`${t.atk}/${t.hp} 召喚`),
    ],
    isPlayer,
    ctx,
    FRAME_DELAY_DEATH_CHAIN,
  );
}

export function handleDevouringGraftDeath({ dead, board, idx, isPlayer, ctx }: DeathContext) {
  const absorbed = ctx.absorbedUnits.get(dead.uid);
  if (!absorbed) return;
  ctx.absorbedUnits.delete(dead.uid);
  const prefix = enemyPrefix(isPlayer);
  const segments = [
    prefix,
    seg.u(dead.name),
    "の腹から",
    seg.u(absorbed.name),
    "が這い出した！ ",
    seg.s(`${absorbed.atk}/${absorbed.hp} 召喚`),
  ];
  const spawned =
    absorbed.id === "token"
      ? spawnTokenAndNotify(
          board,
          idx,
          absorbed.name,
          absorbed.atk,
          absorbed.hp,
          absorbed.isChurch,
          segments,
          isPlayer,
          ctx,
          FRAME_DELAY_DEATH_CHAIN,
        )
      : spawnNamedUnit(absorbed, dead, board, idx, segments, isPlayer, ctx);
  if (spawned && absorbed.equip) spawned.equip = absorbed.equip;
}

function spawnNamedUnit(
  absorbed: AbsorbedData,
  dead: DeathContext["dead"],
  board: DeathContext["board"],
  idx: number,
  segments: LogSegment[],
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
  });
}
