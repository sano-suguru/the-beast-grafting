import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, getMult, enemyPrefix, seg } from "./battle-context";
import { mustGet } from "../shared/invariant";
import { FLY_SPAWN_CAP, FRAME_DELAY_DEATH_CHAIN } from "./constants";
import { atLevel, BEELZEBUB, EVANGELIST, CROW, SIN_EATER, CATHEDRAL } from "../shared/skill-params";
import { spawnTokenAndNotify } from "./battle-spawn";

function collectBeelzebubSpawns(
  board: BattleUnit[],
  flyCount: number,
): { spawns: { beelzebub: BattleUnit; count: number }[] } {
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
  return { spawns };
}

export function handleBeelzebubSpawns(
  board: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
  deathIdx: number,
) {
  const flyCount = isPlayer ? ctx.pFlyCount : ctx.eFlyCount;
  const prefix = enemyPrefix(isPlayer);
  const { spawns } = collectBeelzebubSpawns(board, flyCount);

  let actualSpawned = 0;
  for (const { beelzebub, count } of spawns) {
    const ft = atLevel(BEELZEBUB.token, beelzebub.level);
    for (let m = 0; m < count; m++) {
      const token = spawnTokenAndNotify(
        board,
        deathIdx,
        "腐肉の蠅",
        ft.atk,
        ft.hp,
        beelzebub.isChurch,
        [prefix, seg.u(beelzebub.name), "の周りに蠅が湧く。", seg.s(`${ft.atk}/${ft.hp} 蠅召喚`)],
        isPlayer,
        ctx,
        FRAME_DELAY_DEATH_CHAIN,
      );
      if (!token) break;
      actualSpawned++;
    }
  }
  if (isPlayer) ctx.pFlyCount += actualSpawned;
  else ctx.eFlyCount += actualSpawned;
}

export function handleCrowBuffs(board: BattleUnit[], isPlayer: boolean, ctx: BattleContext) {
  const prefix = enemyPrefix(isPlayer);
  for (let i = 0; i < board.length; i++) {
    const u = board[i]!;
    if (u.id !== "crow" || u.hp <= 0) continue;
    const mult = getMult(board, i);
    for (let m = 0; m < mult; m++) {
      const b = atLevel(CROW.buff, u.level);
      u.atk += b.atk;
      u.hp += b.hp;
      pushFrame(
        ctx,
        "skill",
        [prefix, seg.u(u.name), "が死肉を啄む。", seg.s(`+${b.atk}/+${b.hp}`)],
        "skill",
        { [u.uid]: { type: "buff", value: `+${b.atk}/+${b.hp}` } },
        FRAME_DELAY_DEATH_CHAIN,
      );
    }
  }
}

export function handleSinEaterAbsorb(
  board: BattleUnit[],
  deadAtk: number,
  isPlayer: boolean,
  ctx: BattleContext,
) {
  for (let i = 0; i < board.length; i++) {
    const u = board[i]!;
    if (u.id !== "sin_eater" || u.hp <= 0 || u.skillUses <= 0) continue;
    const mult = getMult(board, i);
    for (let m = 0; m < mult && u.skillUses > 0; m++) {
      const gain = Math.min(deadAtk, atLevel(SIN_EATER.atkCap, u.level));
      if (gain <= 0) continue;
      u.atk += gain;
      u.skillUses -= 1;
      pushFrame(
        ctx,
        "skill",
        [enemyPrefix(isPlayer), seg.u(u.name), `が屍に群がり、殻が膨れる。攻撃+${gain}`],
        "skill",
        { [u.uid]: { type: "buff", value: `+${gain}/+0` } },
        FRAME_DELAY_DEATH_CHAIN,
      );
    }
  }
}

export function handleCathedralSpawns(
  board: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
  deathIdx: number,
) {
  const cathedrals = board.filter((u) => u.id === "cathedral" && u.hp > 0 && u.skillUses > 0);
  for (const u of cathedrals) {
    const idx = board.indexOf(u);
    if (idx === -1) continue;
    const mult = getMult(board, idx);
    for (let m = 0; m < mult && u.skillUses > 0; m++) {
      const t = atLevel(CATHEDRAL.token, u.level);
      u.skillUses -= 1;
      const stat = `${t.atk}/${t.hp}`;
      const token = spawnTokenAndNotify(
        board,
        deathIdx,
        "信徒",
        t.atk,
        t.hp,
        u.isChurch,
        [enemyPrefix(isPlayer), seg.u(u.name), `の扉が軋み、中から信徒が這い出す。${stat}召喚`],
        isPlayer,
        ctx,
        FRAME_DELAY_DEATH_CHAIN,
      );
      if (!token) break;
    }
  }
}

function infectTargets(
  u: BattleUnit,
  enemyBoard: BattleUnit[],
  count: number,
  prefix: string,
  ctx: BattleContext,
) {
  let infected = 0;
  while (infected < count) {
    const candidates = enemyBoard.filter((e) => e.hp > 0 && e.equip !== "infection");
    if (candidates.length === 0) break;
    const target = mustGet(
      candidates,
      Math.floor(ctx.rng.next() * candidates.length),
      "infect target",
    );
    const prevEquip = target.equip;
    target.equip = "infection";
    infected++;
    if (prevEquip && prevEquip !== "infection") {
      pushFrame(
        ctx,
        "skill",
        [prefix, seg.u(target.name), "の装備が疫病に蝕まれた！"],
        "skill",
        { [target.uid]: { type: "damage", value: "装備消去" } },
        FRAME_DELAY_DEATH_CHAIN,
      );
    }
    pushFrame(
      ctx,
      "skill",
      [prefix, seg.u(u.name), "の瘴気が", seg.u(target.name), "に纏わりつく。", seg.e("感染")],
      "skill",
      {
        [u.uid]: { type: "skill" },
        [target.uid]: { type: "defend", value: "感染" },
      },
      FRAME_DELAY_DEATH_CHAIN,
    );
  }
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
    const targets = atLevel(EVANGELIST.targets, u.level);
    for (let m = 0; m < mult; m++) {
      infectTargets(u, enemyBoard, targets, prefix, ctx);
    }
  }
}
