import type { BattleAction, LogSegment } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import { invariant } from "../shared/invariant";
import { pushFrame, enemyPrefix, seg, buffAction, defendAction } from "./battle-context";
import { UNITS } from "../shared/data/units";
import { getUnitsByTier } from "./helpers";
import { FRAME_DELAY_DEATH_CHAIN } from "./constants";
import { spawnTokenAndNotify, spawnSummonedUnitAndNotify } from "./battle-spawn";
import {
  atLevel,
  RAT,
  HOUND,
  BEAST,
  CHURCH_BEAST,
  MAIDEN,
  SQUIRE,
  MARTYR,
  PRIEST,
  HANGED_MAN,
  SERAPH,
  type Buff,
} from "../shared/skill-params";

export type DeathContext = {
  dead: BattleUnit;
  board: BattleUnit[];
  idx: number;
  isPlayer: boolean;
  ctx: BattleContext;
  successor: BattleUnit | null;
  successor2: BattleUnit | null;
};

export type DeathHandler = (context: DeathContext) => void;

function deathBuffAllAllies(
  dead: BattleUnit,
  board: BattleUnit[],
  b: Buff,
  segments: () => LogSegment[],
  ctx: BattleContext,
) {
  if (board.length === 0) return;
  const actionMap: Record<string, BattleAction> = {};
  for (const u of board) {
    u.atk += b.atk;
    u.hp += b.hp;
    actionMap[u.uid] = buffAction(b, dead.uid);
  }
  pushFrame(ctx, "skill", segments, "skill", actionMap, FRAME_DELAY_DEATH_CHAIN);
}

export function handleRatDeath({ dead, board, isPlayer, ctx }: DeathContext) {
  if (board.length === 0) return;
  const b = atLevel(RAT.deathBuff, dead.level);
  const target = board[Math.floor(ctx.rng.next() * board.length)]!;
  target.atk += b.atk;
  target.hp += b.hp;
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    () => [
      prefix,
      seg.u(dead.name),
      "の汚染された血が",
      seg.u(target.name),
      "に変異を促す！ ",
      seg.s(`+${b.atk}/+${b.hp}`),
    ],
    "skill",
    { [target.uid]: buffAction(b, dead.uid) },
    FRAME_DELAY_DEATH_CHAIN,
  );
}

export function handleHoundDeath({ dead, board, idx, isPlayer, ctx }: DeathContext) {
  const t = atLevel(HOUND.token, dead.level);
  spawnTokenAndNotify({
    board,
    idx,
    name: "噛み付く頭部",
    atk: t.atk,
    hp: t.hp,
    isChurch: dead.isChurch,
    segments: () => [
      enemyPrefix(isPlayer),
      seg.u(dead.name),
      "の首が牙を剥く！ ",
      seg.s(`${t.atk}/${t.hp} 召喚`),
    ],
    isPlayer,
    ctx,
    delay: FRAME_DELAY_DEATH_CHAIN,
    spawnerUid: dead.uid,
  });
}

export function handleBeastDeath({ dead, board, idx, isPlayer, ctx }: DeathContext) {
  const t3Pool = getUnitsByTier(3);
  invariant(t3Pool.length > 0, "tier-3 unit pool must not be empty");
  const chosenId = t3Pool[Math.floor(ctx.rng.next() * t3Pool.length)]!;
  const unitData = UNITS[chosenId];
  invariant(unitData, `UNITS[${chosenId}] must exist for tier-3 unit`);
  const t = atLevel(BEAST.summon, dead.level);
  spawnSummonedUnitAndNotify({
    board,
    idx,
    unitData,
    atk: t.atk,
    hp: t.hp,
    isChurch: dead.isChurch,
    level: dead.level,
    segments: () => [
      enemyPrefix(isPlayer),
      seg.u(dead.name),
      "の腹から",
      seg.u(unitData.name),
      "が這い出した！ ",
      seg.s(`${t.atk}/${t.hp} 召喚`),
    ],
    isPlayer,
    ctx,
    delay: FRAME_DELAY_DEATH_CHAIN,
    spawnerUid: dead.uid,
  });
}

export function handleChurchBeastDeath({ dead, board, idx, isPlayer, ctx }: DeathContext) {
  const t = atLevel(CHURCH_BEAST.token, dead.level);
  spawnTokenAndNotify({
    board,
    idx,
    name: "祝福の幼子",
    atk: t.atk,
    hp: t.hp,
    isChurch: dead.isChurch,
    segments: () => [
      enemyPrefix(isPlayer),
      seg.u(dead.name),
      "の腹が裂け、",
      seg.e("祝福"),
      "が現れた！ ",
      seg.s(`${t.atk}/${t.hp} 召喚`),
    ],
    isPlayer,
    ctx,
    delay: FRAME_DELAY_DEATH_CHAIN,
    spawnerUid: dead.uid,
  });
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
    () => [
      enemyPrefix(isPlayer),
      seg.u(dead.name),
      texts.mid,
      seg.u(target.name),
      texts.tail,
      seg.s(`+${b.atk}/+${b.hp}`),
    ],
    "skill",
    { [target.uid]: buffAction(b, dead.uid) },
    FRAME_DELAY_DEATH_CHAIN,
  );
}

export function handleSquireDeath({ dead, isPlayer, ctx, successor }: DeathContext) {
  if (!successor) return;
  const b = atLevel(SQUIRE.deathBuff, dead.level);
  buffSuccessor(dead, successor, b, { mid: "の断末魔。", tail: "が奮い立つ。" }, isPlayer, ctx);
}

export function handlePriestDeath({ dead, board, isPlayer, ctx }: DeathContext) {
  if (board.length === 0) return;
  const b = atLevel(PRIEST.deathBuff, dead.level);
  board.forEach((u) => {
    u.atk += b.atk;
    u.hp += b.hp;
  });
  const actionMap: Record<string, BattleAction> = {};
  board.forEach((u) => (actionMap[u.uid] = buffAction(b, dead.uid)));
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    () => [
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

export function handleMaidenDeath({ dead, board, idx, isPlayer, ctx }: DeathContext) {
  const maxTargets = atLevel(MAIDEN.targets, dead.level);
  const targets = board.slice(idx, idx + maxTargets);
  if (targets.length === 0) return;
  const prefix = enemyPrefix(isPlayer);
  const actionMap: Record<string, BattleAction> = {};
  for (const target of targets) {
    target.equip = "corpse_wax";
    actionMap[target.uid] = defendAction("盾");
  }
  const nameSegs: LogSegment[] = targets.flatMap((t, i) =>
    i === 0 ? [seg.u(t.name)] : ["・", seg.u(t.name)],
  );
  pushFrame(
    ctx,
    "skill",
    () => [prefix, seg.u(dead.name), "の残骸が", ...nameSegs, "を覆う！ ", seg.e("屍蝋の盾")],
    "skill",
    actionMap,
    FRAME_DELAY_DEATH_CHAIN,
  );
}

export function handleMartyrDeath({ dead, isPlayer, ctx, successor, successor2 }: DeathContext) {
  const b = atLevel(MARTYR.deathBuff, dead.level);
  for (const target of [successor, successor2]) {
    if (!target) continue;
    buffSuccessor(dead, target, b, { mid: "が", tail: "へ手を伸ばす。" }, isPlayer, ctx);
  }
}

export function handleHangedManDeath({ dead, board, isPlayer, ctx }: DeathContext) {
  if (board.length === 0) return;
  const targets = Math.min(atLevel(HANGED_MAN.targets, dead.level), board.length);
  // atk: 死亡時も正値のためそのまま使用。hp: 死亡時は<=0のためtakeDamageが保存した最終正値を使用
  const atkShare = Math.floor(dead.atk / targets);
  const hpShare = Math.floor(dead.preDeathHp / targets);
  if (atkShare === 0 && hpShare === 0) return;
  const prefix = enemyPrefix(isPlayer);
  const chosen = board.slice(0, targets);
  const actionMap: Record<string, BattleAction> = {};
  for (const target of chosen) {
    target.atk += atkShare;
    target.hp += hpShare;
    actionMap[target.uid] = buffAction({ atk: atkShare, hp: hpShare }, dead.uid);
  }
  pushFrame(
    ctx,
    "skill",
    () => [
      prefix,
      seg.u(dead.name),
      `の唇が動く。${targets}体の肉が震え、膨れ上がる。`,
      seg.s(`+${atkShare}/+${hpShare}`),
    ],
    "skill",
    actionMap,
    FRAME_DELAY_DEATH_CHAIN,
  );
}

export function handleSeraphDeath({ dead, board, isPlayer, ctx }: DeathContext) {
  const b = atLevel(SERAPH.deathBuff, dead.level);
  const prefix = enemyPrefix(isPlayer);
  deathBuffAllAllies(
    dead,
    board,
    b,
    () => [prefix, seg.u(dead.name), "の光が味方全体を包む。", seg.s(`+${b.atk}/+${b.hp}`)],
    ctx,
  );
}
