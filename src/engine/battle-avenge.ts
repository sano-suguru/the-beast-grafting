import type { UnitId } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import { removeHp } from "./battle-context";
import {
  pushFrame,
  enemyPrefix,
  seg,
  buffAction,
  skillAction,
  damageAction,
} from "./battle-context";
import { atLevel, ARCHANGEL, GRINNING_SKULL } from "../shared/skill-params";
import { FRAME_DELAY_DEATH_CHAIN } from "./constants";

type AvengeCtx = {
  u: BattleUnit;
  board: BattleUnit[];
  idx: number;
  isPlayer: boolean;
  ctx: BattleContext;
};

function handleArchangel({ u, isPlayer, ctx }: AvengeCtx) {
  const b = atLevel(ARCHANGEL.buff, u.level);
  u.atk += b.atk;
  u.hp += b.hp;
  pushFrame(
    ctx,
    "skill",
    () => [
      enemyPrefix(isPlayer),
      seg.u(u.name),
      "の光輪が軋む。翼の一枚が赤く染まる。",
      seg.s(`+${b.atk}/+${b.hp}`),
    ],
    "skill",
    { [u.uid]: buffAction(b, u.uid) },
    FRAME_DELAY_DEATH_CHAIN,
  );
}

interface AvengeSpec {
  id: UnitId;
  threshold: number;
  apply: (h: AvengeCtx) => void;
}

const AVENGE_SPECS: AvengeSpec[] = [
  { id: "archangel", threshold: ARCHANGEL.threshold, apply: handleArchangel },
];

const AVENGE_IDS: ReadonlySet<UnitId> = new Set(AVENGE_SPECS.map((s) => s.id));

function getAvengeSpec(id: UnitId): AvengeSpec | undefined {
  return AVENGE_SPECS.find((s) => s.id === id);
}

/** SAP準拠の独立カウンタ方式: 各ユニットが自身の avengeDeathCount で独立に閾値判定する */
export function processAvenge(board: BattleUnit[], isPlayer: boolean, ctx: BattleContext): void {
  const targets = board.filter((u) => u.hp > 0 && AVENGE_IDS.has(u.id));
  for (const u of targets) {
    if (u.hp <= 0) continue;
    const spec = getAvengeSpec(u.id);
    if (!spec) continue;
    while (u.avengeDeathCount >= spec.threshold) {
      if (u.hp <= 0) break;
      const idx = board.indexOf(u);
      if (idx === -1) break;
      u.avengeDeathCount -= spec.threshold;
      spec.apply({ u, board, idx, isPlayer, ctx });
      if (ctx.opLimitExceeded) return;
    }
  }
}

export function incrementAvengeCounters(board: BattleUnit[]): void {
  for (const u of board) {
    if (u.hp > 0 && AVENGE_IDS.has(u.id)) {
      u.avengeDeathCount++;
    }
  }
}

function fireWolverine(
  u: BattleUnit,
  enemyBoard: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  const hpCut = atLevel(GRINNING_SKULL.hpReduction, u.level);
  const affected = enemyBoard.filter((e) => e.hp > 0);
  if (affected.length === 0) return;
  const actions: Record<string, ReturnType<typeof skillAction>> = { [u.uid]: skillAction() };
  for (const e of affected) {
    const cut = removeHp(e, hpCut);
    actions[e.uid] = damageAction(cut, u.uid);
  }
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    () => [prefix, seg.u(u.name), "が嗤う。敵全体の肉が削げ落ちる。", seg.s(`-${hpCut} HP`)],
    "skill",
    actions,
    FRAME_DELAY_DEATH_CHAIN,
  );
}

function consumeHurtCounter(ctx: BattleContext, isPlayer: boolean): number {
  if (isPlayer) {
    const v = ctx.pHurtThisTick;
    ctx.pHurtThisTick = 0;
    return v;
  }
  const v = ctx.eHurtThisTick;
  ctx.eHurtThisTick = 0;
  return v;
}

/** grinning_skull (Wolverine): 味方が被弾するごとにカウント+1、閾値到達で敵全体HPを削る。
 *  死亡で board から除去されたユニット分の被弾も数えるため、カウンタは BattleContext 側に持つ。 */
export function processWolverine(board: BattleUnit[], isPlayer: boolean, ctx: BattleContext): void {
  const totalHurt = consumeHurtCounter(ctx, isPlayer);
  if (totalHurt === 0) return;
  const enemyBoard = isPlayer ? ctx.eBoard : ctx.pBoard;
  for (const u of board) {
    if (u.id !== "grinning_skull" || u.hp <= 0) continue;
    u.hurtCount += totalHurt;
    while (u.hurtCount >= GRINNING_SKULL.threshold && u.hp > 0) {
      u.hurtCount -= GRINNING_SKULL.threshold;
      fireWolverine(u, enemyBoard, isPlayer, ctx);
      if (ctx.opLimitExceeded) return;
    }
  }
}
