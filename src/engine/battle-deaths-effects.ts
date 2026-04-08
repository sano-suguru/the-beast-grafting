import type { BattleUnit, BattleContext } from "./battle-context";
import {
  pushFrame,
  getMult,
  createToken,
  enemyPrefix,
  seg,
  skillDamageActions,
} from "./battle-context";
import {
  FLY_SPAWN_CAP,
  MAGGOT_TOKEN,
  DEATH_CURSE_TOKEN,
  FRAME_DELAY_DEATH_CHAIN,
} from "./constants";
import { atLevel, BEELZEBUB, EVANGELIST } from "../shared/skill-params";
import { applyZealotBuff } from "./battle-deaths-zealot";

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
      [prefix, seg.u(dead.name), "の傷口から蛆虫が這い出した！ ", seg.s("1/1 召喚")],
      "skill",
      { [token.uid]: { type: "summon" } },
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
      [prefix, seg.u(dead.name), "の呪符が光る。怨念が肉体を繋ぎ止める！ ", seg.s("1/1 蘇生")],
      "skill",
      { [token.uid]: { type: "summon" } },
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
  const flyCount = isPlayer ? ctx.pFlyCount : ctx.eFlyCount;
  const prefix = enemyPrefix(isPlayer);
  const { spawns, totalSpawned } = collectBeelzebubSpawns(board, flyCount);

  for (const { beelzebub, count } of spawns) {
    const ft = atLevel(BEELZEBUB.token, beelzebub.level);
    for (let m = 0; m < count; m++) {
      const token = createToken("腐肉の蠅", ft.atk, ft.hp, beelzebub.isChurch);
      board.splice(deathIdx, 0, token);
      pushFrame(
        ctx,
        "skill",
        [prefix, seg.u(beelzebub.name), "の周りに蠅が湧く。", seg.s(`${ft.atk}/${ft.hp} 蠅召喚`)],
        "skill",
        { [token.uid]: { type: "summon" } },
        FRAME_DELAY_DEATH_CHAIN,
      );
      applyZealotBuff(board, token.uid, isPlayer, ctx);
    }
  }
  if (isPlayer) ctx.pFlyCount += totalSpawned;
  else ctx.eFlyCount += totalSpawned;
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
      if (alive.length === 0) return;
      const target = alive[Math.floor(ctx.rng.next() * alive.length)]!;
      const dmg = atLevel(EVANGELIST.damage, u.level);
      const hpBefore = target.hp;
      target.hp -= dmg;
      pushFrame(
        ctx,
        "skill",
        [
          prefix,
          "屍の上で",
          seg.u(u.name),
          "が祈りを捧げる… ",
          seg.u(target.name),
          "の血が黒く沸き立つ！ ",
          seg.hp(`${hpBefore}→${Math.max(0, target.hp)}`),
        ],
        "skill",
        skillDamageActions(u, target, dmg),
        FRAME_DELAY_DEATH_CHAIN,
      );
    }
  }
}
