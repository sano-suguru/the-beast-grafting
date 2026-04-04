import type { BattleAction, LogSegment, UnitId } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import { invariant, mustGet } from "../shared/invariant";
import { pushFrame, createToken, createSummonedUnit, enemyPrefix, seg } from "./battle-context";
import { UNITS } from "../shared/data/units";
import { getUnitsByTier } from "./helpers";
import { applyZealotBuff } from "./battle-deaths-zealot";
import {
  HOUND_TOKEN,
  BEAST_SUMMON,
  CHURCH_BEAST_TOKEN,
  FRAME_DELAY_DEATH_CHAIN,
} from "./constants";

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
  target.atk += 1;
  target.hp += 1;
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
      seg.s("+1/+1"),
    ],
    "skill",
    {
      [target.uid]: { type: "buff", value: "+1/+1" },
    },
    FRAME_DELAY_DEATH_CHAIN,
  );
}

function handleHoundDeath({ dead, board, idx, isPlayer, ctx }: DeathContext) {
  spawnTokenOnDeath(
    dead,
    board,
    idx,
    isPlayer,
    ctx,
    "噛み付く頭部",
    HOUND_TOKEN.atk,
    HOUND_TOKEN.hp,
    [seg.u(dead.name), "の首が牙を剥く！ ", seg.s(`${HOUND_TOKEN.atk}/${HOUND_TOKEN.hp} 召喚`)],
  );
}

function handleBeastDeath({ dead, board, idx, isPlayer, ctx }: DeathContext) {
  const t3Pool = getUnitsByTier(3);
  invariant(t3Pool.length > 0, "tier-3 unit pool must not be empty");
  const chosenIdx = Math.floor(ctx.rng.next() * t3Pool.length);
  const chosenId = t3Pool[chosenIdx]!;
  const unitData = UNITS[chosenId];
  invariant(unitData, `UNITS[${chosenId}] must exist for tier-3 unit`);
  const summoned = createSummonedUnit(unitData, BEAST_SUMMON.atk, BEAST_SUMMON.hp, dead.isChurch);
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
      seg.s(`${BEAST_SUMMON.atk}/${BEAST_SUMMON.hp} 召喚`),
    ],
    "skill",
    { [summoned.uid]: { type: "summon" } },
    FRAME_DELAY_DEATH_CHAIN,
  );
  applyZealotBuff(board, summoned.uid, isPlayer, ctx);
}

function handleChurchBeastDeath({ dead, board, idx, isPlayer, ctx }: DeathContext) {
  spawnTokenOnDeath(
    dead,
    board,
    idx,
    isPlayer,
    ctx,
    "祝福の幼子",
    CHURCH_BEAST_TOKEN.atk,
    CHURCH_BEAST_TOKEN.hp,
    [
      seg.u(dead.name),
      "の腹が裂け、",
      seg.e("祝福"),
      "が現れた！ ",
      seg.s(`${CHURCH_BEAST_TOKEN.atk}/${CHURCH_BEAST_TOKEN.hp} 召喚`),
    ],
  );
}

function handleSquireDeath({ dead, isPlayer, ctx, successor }: DeathContext) {
  if (!successor) return;
  successor.atk += 1;
  successor.hp += 1;
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    [prefix, seg.u(dead.name), "の断末魔。", seg.u(successor.name), "が奮い立つ。", seg.s("+1/+1")],
    "skill",
    {
      [successor.uid]: { type: "buff", value: "+1/+1" },
    },
    FRAME_DELAY_DEATH_CHAIN,
  );
}

function handlePriestDeath({ dead, board, isPlayer, ctx }: DeathContext) {
  if (board.length === 0) return;
  board.forEach((u) => (u.hp += 1));
  const actionMap: Record<string, BattleAction> = {};
  board.forEach((u) => (actionMap[u.uid] = { type: "heal", value: "+1" }));
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    [prefix, seg.u(dead.name), "が崩れ落ちる。その唇がまだ動いている。味方全体", seg.s("+1")],
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
  const prefix = enemyPrefix(isPlayer);
  const targets = [successor, successor2];
  for (const target of targets) {
    if (!target) continue;
    target.atk += 1;
    target.hp += 1;
    pushFrame(
      ctx,
      "skill",
      [prefix, seg.u(dead.name), "が", seg.u(target.name), "へ手を伸ばす。", seg.s("+1/+1")],
      "skill",
      {
        [target.uid]: { type: "buff", value: "+1/+1" },
      },
      FRAME_DELAY_DEATH_CHAIN,
    );
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
