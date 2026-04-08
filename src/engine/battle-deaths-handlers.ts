import type { BattleAction, LogSegment, UnitId } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import { invariant, mustGet } from "../shared/invariant";
import { pushFrame, createToken, createSummonedUnit, enemyPrefix, seg } from "./battle-context";
import { UNITS } from "../shared/data/units";
import { getUnitsByTier } from "./helpers";
import { applyZealotBuff } from "./battle-deaths-zealot";
import { FRAME_DELAY_DEATH_CHAIN } from "./constants";
import {
  atLevel,
  RAT,
  HOUND,
  BEAST,
  CHURCH_BEAST,
  SQUIRE,
  MARTYR,
  PRIEST,
  type Buff,
} from "../shared/skill-params";

type DeathContext = {
  dead: BattleUnit;
  board: BattleUnit[];
  idx: number;
  isPlayer: boolean;
  ctx: BattleContext;
  successor: BattleUnit | null;
  successor2: BattleUnit | null;
};

type DeathHandler = (context: DeathContext) => void;

function spawnTokenOnDeath(
  dead: BattleUnit,
  board: BattleUnit[],
  idx: number,
  isPlayer: boolean,
  ctx: BattleContext,
  tokenName: string,
  atk: number,
  hp: number,
  segments: LogSegment[],
) {
  const token = createToken(tokenName, atk, hp, dead.isChurch);
  board.splice(idx, 0, token);
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    [prefix, ...segments],
    "skill",
    {
      [token.uid]: { type: "summon" },
    },
    FRAME_DELAY_DEATH_CHAIN,
  );
  applyZealotBuff(board, token.uid, isPlayer, ctx);
}

function handleRatDeath({ dead, board, isPlayer, ctx }: DeathContext) {
  if (board.length === 0) return;
  const target = mustGet(board, Math.floor(ctx.rng.next() * board.length), "rat death target");
  const b = atLevel(RAT.deathBuff, dead.level);
  target.atk += b.atk;
  target.hp += b.hp;
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    [
      prefix,
      seg.u(dead.name),
      "の汚染された血が",
      seg.u(target.name),
      "に変異を促す！ ",
      seg.s(`+${b.atk}/+${b.hp}`),
    ],
    "skill",
    {
      [target.uid]: { type: "buff", value: `+${b.atk}/+${b.hp}` },
    },
    FRAME_DELAY_DEATH_CHAIN,
  );
}

function handleHoundDeath({ dead, board, idx, isPlayer, ctx }: DeathContext) {
  const t = atLevel(HOUND.token, dead.level);
  spawnTokenOnDeath(dead, board, idx, isPlayer, ctx, "噛み付く頭部", t.atk, t.hp, [
    seg.u(dead.name),
    "の首が牙を剥く！ ",
    seg.s(`${t.atk}/${t.hp} 召喚`),
  ]);
}

function handleBeastDeath({ dead, board, idx, isPlayer, ctx }: DeathContext) {
  const t3Pool = getUnitsByTier(3);
  invariant(t3Pool.length > 0, "tier-3 unit pool must not be empty");
  const chosenIdx = Math.floor(ctx.rng.next() * t3Pool.length);
  const chosenId = t3Pool[chosenIdx]!;
  const unitData = UNITS[chosenId];
  invariant(unitData, `UNITS[${chosenId}] must exist for tier-3 unit`);
  const t = atLevel(BEAST.summon, dead.level);
  const summoned = createSummonedUnit(unitData, t.atk, t.hp, dead.isChurch);
  board.splice(idx, 0, summoned);
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    [
      prefix,
      seg.u(dead.name),
      "の腹から",
      seg.u(summoned.name),
      "が這い出した！ ",
      seg.s(`${t.atk}/${t.hp} 召喚`),
    ],
    "skill",
    { [summoned.uid]: { type: "summon" } },
    FRAME_DELAY_DEATH_CHAIN,
  );
  applyZealotBuff(board, summoned.uid, isPlayer, ctx);
}

function handleChurchBeastDeath({ dead, board, idx, isPlayer, ctx }: DeathContext) {
  const t = atLevel(CHURCH_BEAST.token, dead.level);
  spawnTokenOnDeath(dead, board, idx, isPlayer, ctx, "祝福の幼子", t.atk, t.hp, [
    seg.u(dead.name),
    "の腹が裂け、",
    seg.e("祝福"),
    "が現れた！ ",
    seg.s(`${t.atk}/${t.hp} 召喚`),
  ]);
}

function buffSuccessor(
  dead: BattleUnit,
  target: BattleUnit,
  b: Buff,
  texts: { mid: string; tail: string },
  isPlayer: boolean,
  ctx: BattleContext,
) {
  target.atk += b.atk;
  target.hp += b.hp;
  pushFrame(
    ctx,
    "skill",
    [
      enemyPrefix(isPlayer),
      seg.u(dead.name),
      texts.mid,
      seg.u(target.name),
      texts.tail,
      seg.s(`+${b.atk}/+${b.hp}`),
    ],
    "skill",
    { [target.uid]: { type: "buff", value: `+${b.atk}/+${b.hp}` } },
    FRAME_DELAY_DEATH_CHAIN,
  );
}

function handleSquireDeath({ dead, isPlayer, ctx, successor }: DeathContext) {
  if (!successor) return;
  const b = atLevel(SQUIRE.deathBuff, dead.level);
  buffSuccessor(dead, successor, b, { mid: "の断末魔。", tail: "が奮い立つ。" }, isPlayer, ctx);
}

function handlePriestDeath({ dead, board, isPlayer, ctx }: DeathContext) {
  if (board.length === 0) return;
  const b = atLevel(PRIEST.deathBuff, dead.level);
  board.forEach((u) => {
    u.atk += b.atk;
    u.hp += b.hp;
  });
  const actionMap: Record<string, BattleAction> = {};
  board.forEach((u) => (actionMap[u.uid] = { type: "buff", value: `+${b.atk}/+${b.hp}` }));
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    [
      prefix,
      seg.u(dead.name),
      "が崩れ落ちる。その唇がまだ動いている。味方全体",
      seg.s(`+${b.atk}/+${b.hp}`),
    ],
    "skill",
    actionMap,
    FRAME_DELAY_DEATH_CHAIN,
  );
}

function handleMaidenDeath({ dead, isPlayer, ctx, successor }: DeathContext) {
  if (!successor) return;
  successor.equip = "corpse_wax";
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    [
      prefix,
      seg.u(dead.name),
      "の残骸が",
      seg.u(successor.name),
      "を覆う！ ",
      seg.s("屍蝋の盾付与"),
    ],
    "skill",
    {
      [successor.uid]: { type: "defend", value: "盾" },
    },
    FRAME_DELAY_DEATH_CHAIN,
  );
}

function handleMartyrDeath({ dead, isPlayer, ctx, successor, successor2 }: DeathContext) {
  const b = atLevel(MARTYR.deathBuff, dead.level);
  for (const target of [successor, successor2]) {
    if (!target) continue;
    buffSuccessor(dead, target, b, { mid: "が", tail: "へ手を伸ばす。" }, isPlayer, ctx);
  }
}

export const UNIT_DEATH_HANDLERS = {
  rat: handleRatDeath,
  hound: handleHoundDeath,
  church_hound: handleHoundDeath,
  beast: handleBeastDeath,
  martyr: handleMartyrDeath,
  church_beast: handleChurchBeastDeath,
  squire: handleSquireDeath,
  priest: handlePriestDeath,
  maiden: handleMaidenDeath,
} satisfies Partial<Record<UnitId, DeathHandler>>;

export type DeathHandlerUnitId = keyof typeof UNIT_DEATH_HANDLERS;

export function getDeathHandler(id: UnitId): DeathHandler | undefined {
  return Object.hasOwn(UNIT_DEATH_HANDLERS, id)
    ? UNIT_DEATH_HANDLERS[id as DeathHandlerUnitId]
    : undefined;
}

export {
  handleEquipDeath,
  handleBeelzebubSpawns,
  handleEvangelistPlague,
} from "./battle-deaths-effects";
