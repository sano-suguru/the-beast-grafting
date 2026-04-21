import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, getMult, enemyPrefix, seg, buffAction, aoeBuffActions } from "./battle-context";
import { FRAME_DELAY_DEATH_CHAIN } from "./constants";
import { atLevel, INSATIABLE_MAW, BONE_TREE } from "../shared/skill-params";

interface ReactorIterCtx {
  u: BattleUnit;
  idx: number;
  prefix: string;
}

function applyAllyDeathReaction(
  board: BattleUnit[],
  unitId: string,
  isPlayer: boolean,
  apply: (r: ReactorIterCtx) => false | void,
  filter?: (reactorIdx: number) => boolean,
) {
  const prefix = enemyPrefix(isPlayer);
  for (let i = 0; i < board.length; i++) {
    const u = board[i]!;
    if (u.id !== unitId || u.hp <= 0) continue;
    if (filter && !filter(i)) continue;
    const mult = getMult(board, i);
    for (let m = 0; m < mult && u.skillUses > 0; m++) {
      u.skillUses -= 1;
      if (apply({ u, idx: i, prefix }) === false) {
        u.skillUses += 1;
        break;
      }
    }
  }
}

export function handleInsatiableMawBuff(
  board: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  const prefix = enemyPrefix(isPlayer);
  for (let i = 0; i < board.length; i++) {
    const u = board[i]!;
    if (u.id !== "insatiable_maw" || u.hp <= 0) continue;
    const mult = getMult(board, i);
    const b = atLevel(INSATIABLE_MAW.buff, u.level);
    for (let m = 0; m < mult; m++) {
      u.atk += b.atk;
      u.hp += b.hp;
      pushFrame(
        ctx,
        "skill",
        () => [
          prefix,
          seg.u(u.name),
          "の咢が脈動する。牙の間から涎が垂れ、膨れ上がる。",
          seg.s(`+${b.atk}/+${b.hp}`),
        ],
        "skill",
        { [u.uid]: buffAction(b, u.uid) },
        FRAME_DELAY_DEATH_CHAIN,
      );
    }
  }
}

export function handleBoneTreeAllyDeath(
  board: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  applyAllyDeathReaction(board, "bone_tree", isPlayer, ({ u, idx, prefix }) => {
    const b = atLevel(BONE_TREE.buff, u.level);
    const targets = board.slice(0, idx).filter((t): t is BattleUnit => t.hp > 0);
    if (targets.length === 0) return false;
    for (const t of targets) {
      t.atk += b.atk;
      t.hp += b.hp;
    }
    pushFrame(
      ctx,
      "skill",
      () => [
        prefix,
        seg.u(u.name),
        "の根が震え、前方の味方を強化した。",
        seg.s(`+${b.atk}/+${b.hp}`),
      ],
      "skill",
      {
        [u.uid]: { type: "skill" },
        ...aoeBuffActions(u, targets, b),
      },
      FRAME_DELAY_DEATH_CHAIN,
    );
    return;
  });
}

export function handleCarrionSentinelAllyDeath(
  board: BattleUnit[],
  deathIdx: number,
  isPlayer: boolean,
  ctx: BattleContext,
) {
  applyAllyDeathReaction(
    board,
    "carrion_sentinel",
    isPlayer,
    ({ u, prefix }) => {
      u.atk += 1;
      u.equip = "corpse_wax";
      pushFrame(
        ctx,
        "skill",
        () => [
          prefix,
          seg.u(u.name),
          "が前衛の死を浴びて硬化する。",
          seg.s("+1/+0"),
          " + ",
          seg.e("屍蝋の盾"),
        ],
        "skill",
        { [u.uid]: buffAction({ atk: 1, hp: 0 }) },
        FRAME_DELAY_DEATH_CHAIN,
      );
    },
    (i) => i === deathIdx,
  );
}
