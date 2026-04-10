import type { UnitId } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, enemyPrefix, seg, aoeBuffActions } from "./battle-context";
import { atLevel, CHARNEL_PIT, GRINNING_SKULL, ARCHANGEL } from "../shared/skill-params";
import { FRAME_DELAY_DEATH_CHAIN } from "./constants";
import { spawnTokenAndNotify } from "./battle-spawn";

function spawnAvengeToken(
  u: BattleUnit,
  board: BattleUnit[],
  idx: number,
  name: string,
  atk: number,
  hp: number,
  text: string,
  isPlayer: boolean,
  ctx: BattleContext,
) {
  spawnTokenAndNotify(
    board,
    idx,
    name,
    atk,
    hp,
    u.isChurch,
    [enemyPrefix(isPlayer), seg.u(u.name), text, seg.s(`${atk}/${hp} 召喚`)],
    isPlayer,
    ctx,
    FRAME_DELAY_DEATH_CHAIN,
  );
}

type AvengeCtx = {
  u: BattleUnit;
  board: BattleUnit[];
  idx: number;
  isPlayer: boolean;
  ctx: BattleContext;
};

function handleCharnelPit({ u, board, idx, isPlayer, ctx }: AvengeCtx) {
  const t = atLevel(CHARNEL_PIT.token, u.level);
  spawnAvengeToken(u, board, idx, "肉塊", t.atk, t.hp, "から肉塊が溢れ出す！ ", isPlayer, ctx);
}

function handleGrinningSkull({ u, board, isPlayer, ctx }: AvengeCtx) {
  const prefix = enemyPrefix(isPlayer);
  const b = atLevel(GRINNING_SKULL.buff, u.level);
  const buffed: BattleUnit[] = [];
  for (const ally of board) {
    if (ally.hp <= 0) continue;
    ally.atk += b.atk;
    ally.hp += b.hp;
    buffed.push(ally);
  }
  pushFrame(
    ctx,
    "skill",
    [prefix, seg.u(u.name), "が開く…味方全体に", seg.s(`+${b.atk}/+${b.hp}`)],
    "skill",
    aoeBuffActions(u, buffed, `+${b.atk}/+${b.hp}`),
    FRAME_DELAY_DEATH_CHAIN,
  );
}

function handleArchangel({ u, isPlayer, ctx }: AvengeCtx) {
  const b = atLevel(ARCHANGEL.buff, u.level);
  u.atk += b.atk;
  u.hp += b.hp;
  const stat = `${b.atk}/${b.hp}`;
  pushFrame(
    ctx,
    "skill",
    [enemyPrefix(isPlayer), seg.u(u.name), `の光輪が軋む。翼の一枚が赤く染まる。+${stat}`],
    "skill",
    { [u.uid]: { type: "buff", value: `+${stat}` } },
    FRAME_DELAY_DEATH_CHAIN,
  );
}

interface AvengeSpec {
  id: UnitId;
  threshold: number;
  apply: (h: AvengeCtx) => void;
}

const AVENGE_SPECS: AvengeSpec[] = [
  { id: "charnel_pit", threshold: CHARNEL_PIT.threshold, apply: handleCharnelPit },
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
