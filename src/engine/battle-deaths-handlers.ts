import type { BattleAction, UnitId } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import { invariant, mustGet } from "../shared/invariant";
import { pushFrame, getMult, createToken, createSummonedUnit, enemyPrefix } from "./battle-context";
import { UNITS } from "../shared/data/units";
import { getUnitsByTier } from "./helpers";
import { computeZealotBuff } from "./buff-utils";
import {
  FLY_SPAWN_CAP,
  FLY_TOKEN,
  HOUND_TOKEN,
  BEAST_SUMMON,
  CHURCH_BEAST_TOKEN,
  MAGGOT_TOKEN,
  DEATH_CURSE_TOKEN,
  FRAME_DELAY_DEATH_CHAIN,
  EVANGELIST_PLAGUE_DAMAGE,
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

function applyZealotBuff(
  boardArray: BattleUnit[],
  tokenUid: string,
  isPlayer: boolean,
  ctx: BattleContext,
) {
  const buffAmount = computeZealotBuff(boardArray, {
    requireAlive: true,
    getMultiplier: (idx) => getMult(boardArray, idx),
  });
  if (buffAmount <= 0) return;
  const zealot = boardArray.find((u) => u.id === "zealot" && u.hp > 0);
  invariant(zealot, "zealot must exist when buffAmount > 0");
  const zealotName = zealot.name;
  const token = boardArray.find((u) => u.uid === tokenUid);
  if (!token) return;
  token.atk += buffAmount;
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    `${prefix}[${zealotName}]が呪詛を唱える！ [${token.name}]の攻撃+${buffAmount}`,
    "skill",
    {
      [tokenUid]: { type: "buff", value: `+${buffAmount}/+0` },
    },
    FRAME_DELAY_DEATH_CHAIN,
  );
}

function spawnTokenOnDeath(
  dead: BattleUnit,
  board: BattleUnit[],
  idx: number,
  isPlayer: boolean,
  ctx: BattleContext,
  tokenName: string,
  atk: number,
  hp: number,
  message: string,
) {
  const token = createToken(tokenName, atk, hp, dead.isChurch);
  board.splice(idx, 0, token);
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    `${prefix}${message}`,
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
    `${prefix}[${dead.name}]の汚染された血が[${target.name}]に変異を促す！ (+1/+1)`,
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
    `[${dead.name}]の首が牙を剥く！ (${HOUND_TOKEN.atk}/${HOUND_TOKEN.hp} 召喚)`,
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
    `${prefix}[${dead.name}]の腹から[${summoned.name}]が這い出した！ (${BEAST_SUMMON.atk}/${BEAST_SUMMON.hp} 召喚)`,
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
    `[${dead.name}]の腹が裂け、『祝福』が現れた！ (${CHURCH_BEAST_TOKEN.atk}/${CHURCH_BEAST_TOKEN.hp} 召喚)`,
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
    `${prefix}[${dead.name}]の遺志が後衛の[${successor.name}]を鼓舞する！ (+1/+1)`,
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
    `${prefix}[${dead.name}]の祈りが味方全体を癒す！ (+1)`,
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
    `${prefix}[${dead.name}]の残骸が[${successor.name}]を覆う！ (屍蝋の盾付与)`,
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
      `${prefix}[${dead.name}]の遺志！ [${target.name}]が鼓舞された(+1/+1)`,
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

export function handleEquipDeath(
  dead: BattleUnit,
  board: BattleUnit[],
  idx: number,
  isPlayer: boolean,
  ctx: BattleContext,
) {
  const prefix = enemyPrefix(isPlayer);
  if (dead.equip === "maggot_nest") {
    const token = createToken("巨大蛆虫", MAGGOT_TOKEN.atk, MAGGOT_TOKEN.hp, dead.isChurch);
    board.splice(idx, 0, token);
    pushFrame(
      ctx,
      "skill",
      `${prefix}[${dead.name}]の傷口から蛆虫が這い出した！ (1/1 召喚)`,
      "skill",
      {
        [token.uid]: { type: "summon" },
      },
      FRAME_DELAY_DEATH_CHAIN,
    );
    applyZealotBuff(board, token.uid, isPlayer, ctx);
  }
  if (dead.equip === "death_curse") {
    const token = createToken(
      dead.name,
      DEATH_CURSE_TOKEN.atk,
      DEATH_CURSE_TOKEN.hp,
      dead.isChurch,
    );
    board.splice(idx, 0, token);
    pushFrame(
      ctx,
      "skill",
      `${prefix}[${dead.name}]の呪符が発動！ 怨念が肉体を繋ぎ止める！ (1/1 蘇生)`,
      "skill",
      {
        [token.uid]: { type: "summon" },
      },
      FRAME_DELAY_DEATH_CHAIN,
    );
    applyZealotBuff(board, token.uid, isPlayer, ctx);
  }
}

function collectBeelzebubSpawns(
  board: BattleUnit[],
  flyCount: number,
): { spawns: { beelzebub: BattleUnit; count: number }[]; totalSpawned: number } {
  const spawns: { beelzebub: BattleUnit; count: number }[] = [];
  let remaining = FLY_SPAWN_CAP - flyCount;
  for (let i = 0; i < board.length; i++) {
    const u = board[i]!;
    if (u.id !== "beelzebub" || u.hp <= 0) continue;
    const mult = getMult(board, i);
    const count = Math.min(mult, remaining);
    if (count <= 0) continue;
    spawns.push({ beelzebub: u, count });
    remaining -= count;
    if (remaining <= 0) break;
  }
  const totalSpawned = spawns.reduce((sum, s) => sum + s.count, 0);
  return { spawns, totalSpawned };
}

export function handleBeelzebubSpawns(
  board: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
  deathIdx: number,
) {
  const flyCountKey = isPlayer ? "pFlyCount" : "eFlyCount";
  const prefix = enemyPrefix(isPlayer);
  const { spawns, totalSpawned } = collectBeelzebubSpawns(board, ctx[flyCountKey]);

  for (const { beelzebub, count } of spawns) {
    for (let m = 0; m < count; m++) {
      const token = createToken("腐肉の蠅", FLY_TOKEN.atk, FLY_TOKEN.hp, beelzebub.isChurch);
      board.splice(deathIdx, 0, token);
      pushFrame(
        ctx,
        "skill",
        `${prefix}[${beelzebub.name}]の瘴気が死肉に群がる蠅を呼ぶ！ (${FLY_TOKEN.atk}/${FLY_TOKEN.hp} 蠅召喚)`,
        "skill",
        {
          [token.uid]: { type: "summon" },
        },
        FRAME_DELAY_DEATH_CHAIN,
      );
      applyZealotBuff(board, token.uid, isPlayer, ctx);
    }
  }
  ctx[flyCountKey] += totalSpawned;
}

export function handleEvangelistPlague(
  board: BattleUnit[],
  enemyBoard: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  const prefix = enemyPrefix(isPlayer);
  for (let i = 0; i < board.length; i++) {
    const u = board[i]!;
    if (u.id !== "evangelist" || u.hp <= 0) continue;
    const mult = getMult(board, i);
    for (let m = 0; m < mult; m++) {
      const alive = enemyBoard.filter((e) => e.hp > 0);
      // 敵全滅 → 残りの evangelist も対象なしのため関数ごと終了
      if (alive.length === 0) return;
      const target = alive[Math.floor(ctx.rng.next() * alive.length)]!;
      target.hp -= EVANGELIST_PLAGUE_DAMAGE;
      pushFrame(
        ctx,
        "skill",
        `${prefix}屍の上で[${u.name}]が祈りを捧げる… [${target.name}]の血が黒く沸き立つ！ ${EVANGELIST_PLAGUE_DAMAGE} ダメージ。`,
        "skill",
        {
          [u.uid]: { type: "skill" },
          [target.uid]: { type: "damage", value: `-${EVANGELIST_PLAGUE_DAMAGE}` },
        },
        FRAME_DELAY_DEATH_CHAIN,
      );
    }
  }
}
