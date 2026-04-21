import type { UnitId } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import type { Scaled, Buff } from "../shared/skill-params";
import { buffAllAlive } from "./battle-context";
import { pushFrame, enemyPrefix, seg, aoeBuffActions, buffAction } from "./battle-context";
import { atLevel, GRINNING_SKULL, ARCHANGEL } from "../shared/skill-params";
import { FRAME_DELAY_DEATH_CHAIN } from "./constants";

type AvengeCtx = {
  u: BattleUnit;
  board: BattleUnit[];
  idx: number;
  isPlayer: boolean;
  ctx: BattleContext;
};

function avengeAoeBuff(
  { u, board, isPlayer, ctx }: AvengeCtx,
  params: { buff: Scaled<Buff> },
  logText: string,
) {
  const prefix = enemyPrefix(isPlayer);
  const b = atLevel(params.buff, u.level);
  const buffed = buffAllAlive(board, b);
  pushFrame(
    ctx,
    "skill",
    () => [prefix, seg.u(u.name), logText, seg.s(`+${b.atk}/+${b.hp}`)],
    "skill",
    aoeBuffActions(u, buffed, b),
    FRAME_DELAY_DEATH_CHAIN,
  );
}

function handleGrinningSkull(c: AvengeCtx) {
  if (c.u.skillUses <= 0) return;
  c.u.skillUses -= 1;
  avengeAoeBuff(c, GRINNING_SKULL, "が開く…味方全体に");
}

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
  { id: "grinning_skull", threshold: GRINNING_SKULL.threshold, apply: handleGrinningSkull },
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
