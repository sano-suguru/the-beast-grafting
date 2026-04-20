import type { BattleUnit, BattleContext } from "./battle-context";
import { getMult, enemyPrefix, seg } from "./battle-context";
import { FRAME_DELAY_DEATH_CHAIN } from "./constants";
import { atLevel, BEELZEBUB, CATHEDRAL } from "../shared/skill-params";
import { spawnTokenAndNotify } from "./battle-spawn";

function collectBeelzebubSpawns(board: BattleUnit[]): {
  spawns: { beelzebub: BattleUnit; count: number }[];
} {
  const spawns: { beelzebub: BattleUnit; count: number }[] = [];
  for (let i = 0; i < board.length; i++) {
    const u = board[i]!;
    if (u.id !== "beelzebub" || u.hp <= 0) continue;
    const mult = getMult(board, i);
    if (mult <= 0) continue;
    spawns.push({ beelzebub: u, count: mult });
  }
  return { spawns };
}

export function handleBeelzebubSpawns(
  board: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
  deathIdx: number,
) {
  const prefix = enemyPrefix(isPlayer);
  const { spawns } = collectBeelzebubSpawns(board);

  for (const { beelzebub, count } of spawns) {
    if (beelzebub.skillUses <= 0) continue;
    const ft = atLevel(BEELZEBUB.token, beelzebub.level);
    for (let m = 0; m < count && beelzebub.skillUses > 0; m++) {
      beelzebub.skillUses -= 1;
      const token = spawnTokenAndNotify({
        board,
        idx: deathIdx,
        name: "腐肉の蠅",
        atk: ft.atk,
        hp: ft.hp,
        isChurch: beelzebub.isChurch,
        segments: () => [
          prefix,
          seg.u(beelzebub.name),
          "の周りに蠅が湧く。",
          seg.s(`${ft.atk}/${ft.hp} 蠅召喚`),
        ],
        isPlayer,
        ctx,
        delay: FRAME_DELAY_DEATH_CHAIN,
        spawnerUid: beelzebub.uid,
      });
      if (!token) break;
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
      const token = spawnTokenAndNotify({
        board,
        idx: deathIdx,
        name: "信徒",
        atk: t.atk,
        hp: t.hp,
        isChurch: u.isChurch,
        segments: () => [
          enemyPrefix(isPlayer),
          seg.u(u.name),
          "の扉が軋み、中から信徒が這い出す。",
          seg.s(`${stat} 召喚`),
        ],
        isPlayer,
        ctx,
        delay: FRAME_DELAY_DEATH_CHAIN,
        spawnerUid: u.uid,
      });
      if (!token) break;
    }
  }
}
