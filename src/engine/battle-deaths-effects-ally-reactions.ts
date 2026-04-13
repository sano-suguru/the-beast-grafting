import type { LogSegment } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, getMult, enemyPrefix, seg } from "./battle-context";
import { mustGet } from "../shared/invariant";
import { FRAME_DELAY_DEATH_CHAIN } from "./constants";
import { atLevel, CRAWLING_CORD, INSATIABLE_MAW, type Buff } from "../shared/skill-params";

function applyAllyDeathReaction(
  board: BattleUnit[],
  unitId: string,
  isPlayer: boolean,
  apply: (u: BattleUnit, prefix: string) => void,
) {
  const prefix = enemyPrefix(isPlayer);
  for (let i = 0; i < board.length; i++) {
    const u = board[i]!;
    if (u.id !== unitId || u.hp <= 0) continue;
    const mult = getMult(board, i);
    for (let m = 0; m < mult; m++) apply(u, prefix);
  }
}

export function handleCrawlingCordBuff(board: BattleUnit[], isPlayer: boolean, ctx: BattleContext) {
  applyAllyDeathReaction(board, "crawling_cord", isPlayer, (u, prefix) => {
    const b = atLevel(CRAWLING_CORD.buff, u.level);
    const alive = board.filter((a) => a.hp > 0 && a.uid !== u.uid);
    if (alive.length === 0) return;
    const target = mustGet(alive, Math.floor(ctx.rng.next() * alive.length), "cord buff target");
    buffAlly(ctx, target, b, [
      prefix,
      seg.u(u.name),
      "が蠢き、",
      seg.u(target.name),
      "に巻きつく。",
      seg.s(`+${b.atk}/+${b.hp}`),
    ]);
  });
}

export function handleInsatiableMawBuff(
  board: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  applyAllyDeathReaction(board, "insatiable_maw", isPlayer, (u, prefix) => {
    const b = atLevel(INSATIABLE_MAW.buff, u.level);
    buffAlly(ctx, u, b, [
      prefix,
      seg.u(u.name),
      "の咢が脈動する。牙の間から涎が垂れ、膨れ上がる。",
      seg.s(`+${b.atk}/+${b.hp}`),
    ]);
  });
}

function buffAlly(ctx: BattleContext, target: BattleUnit, b: Buff, segments: LogSegment[]) {
  target.atk += b.atk;
  target.hp += b.hp;
  pushFrame(
    ctx,
    "skill",
    segments,
    "skill",
    {
      [target.uid]: { type: "buff", value: `+${b.atk}/+${b.hp}` },
    },
    FRAME_DELAY_DEATH_CHAIN,
  );
}
