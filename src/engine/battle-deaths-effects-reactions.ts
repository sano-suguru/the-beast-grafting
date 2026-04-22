import type { BattleUnit, BattleContext } from "./battle-context";
import { runWithBrainsRepeat, enemyPrefix, seg } from "./battle-context";
import { FRAME_DELAY_DEATH_CHAIN } from "./constants";
import { atLevel, BEELZEBUB, CATHEDRAL } from "../shared/skill-params";
import { spawnTokenAndNotify } from "./battle-spawn";
import type { LogSegment } from "../shared/types";

type SpawnerConfig = {
  unitId: string;
  tokenName: string;
  stat: (u: BattleUnit) => { atk: number; hp: number };
  segments: (u: BattleUnit, prefix: string, atk: number, hp: number) => LogSegment[];
};

function runSpawnReaction(
  board: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
  deathIdx: number,
  cfg: SpawnerConfig,
) {
  const prefix = enemyPrefix(isPlayer);
  const spawners = board.filter((u) => u.id === cfg.unitId && u.hp > 0);
  for (const u of spawners) {
    const i = board.indexOf(u);
    if (i === -1) continue;
    let spawnBlocked = false;
    runWithBrainsRepeat(u, board, i, () => {
      if (spawnBlocked || u.skillUses <= 0) return;
      const t = cfg.stat(u);
      u.skillUses -= 1;
      const token = spawnTokenAndNotify({
        board,
        idx: deathIdx,
        name: cfg.tokenName,
        atk: t.atk,
        hp: t.hp,
        isChurch: u.isChurch,
        segments: () => cfg.segments(u, prefix, t.atk, t.hp),
        isPlayer,
        ctx,
        delay: FRAME_DELAY_DEATH_CHAIN,
        spawnerUid: u.uid,
      });
      if (!token) spawnBlocked = true;
    });
  }
}

export function handleBeelzebubSpawns(
  board: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
  deathIdx: number,
) {
  runSpawnReaction(board, isPlayer, ctx, deathIdx, {
    unitId: "beelzebub",
    tokenName: "腐肉の蠅",
    stat: (u) => atLevel(BEELZEBUB.token, u.level),
    segments: (u, prefix, atk, hp) => [
      prefix,
      seg.u(u.name),
      "の周りに蠅が湧く。",
      seg.s(`${atk}/${hp} 蠅召喚`),
    ],
  });
}

export function handleCathedralSpawns(
  board: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
  deathIdx: number,
) {
  runSpawnReaction(board, isPlayer, ctx, deathIdx, {
    unitId: "cathedral",
    tokenName: "信徒",
    stat: (u) => atLevel(CATHEDRAL.token, u.level),
    segments: (u, prefix, atk, hp) => [
      prefix,
      seg.u(u.name),
      "の扉が軋み、中から信徒が這い出す。",
      seg.s(`${atk}/${hp} 召喚`),
    ],
  });
}
