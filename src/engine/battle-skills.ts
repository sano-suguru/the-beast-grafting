import type { UnitId } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, getMult, enemyPrefix, seg } from "./battle-context";
import { mustGet } from "../shared/invariant";
import { SUPPORT_IDX } from "./constants";
import type { SkillContext, BeforeAttackArgs } from "./battle-skills-util";
import {
  applyBatSkill,
  applyInquisitorSkill,
  applyBansheeSkill,
  applyRevenantSkill,
  applyCatacombRatSkill,
  applyPlagueBellSkill,
  applyPaladinSkill,
  applyHolyFireSkill,
} from "./battle-skills-start";
import {
  applyParasiteBuff,
  applyEyeGaze,
  applyFamineDebuff,
  applyRelicSwordBuff,
} from "./battle-skills-before-attack";

// ── 開戦スキルレジストリ ──

type StartSkillHandler = (context: SkillContext) => void;

const START_SKILL_HANDLERS = {
  bat: applyBatSkill,
  inquisitor: applyInquisitorSkill,
  shrieking_throat: applyBansheeSkill,
  revenant: applyRevenantSkill,
  catacomb_rat: applyCatacombRatSkill,
  plague_bell: applyPlagueBellSkill,
  paladin: applyPaladinSkill,
  holy_fire: applyHolyFireSkill,
} satisfies Partial<Record<UnitId, StartSkillHandler>>;

type StartSkillUnitId = keyof typeof START_SKILL_HANDLERS;

function getStartSkillHandler(id: UnitId): StartSkillHandler | undefined {
  return Object.hasOwn(START_SKILL_HANDLERS, id)
    ? START_SKILL_HANDLERS[id as StartSkillUnitId]
    : undefined;
}

export function runStartSkills(
  boardArr: BattleUnit[],
  targetArr: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  boardArr.forEach((u) => {
    const handler = getStartSkillHandler(u.id);
    if (!handler) return;
    handler({ u, targetArr, isPlayer, ctx });
  });
}

// ── Cholera (board iteration + スキル実装を同居) ──

function applyCholeraSkill({ u, targetArr, isPlayer, ctx }: SkillContext) {
  if (targetArr.length === 0) return;
  const targetIdx = Math.floor(ctx.rng.next() * targetArr.length);
  const target = mustGet(targetArr, targetIdx, "cholera target");
  const prevEquip = target.equip;
  target.equip = "infection";
  const prefix = enemyPrefix(isPlayer);
  if (prevEquip && prevEquip !== "infection") {
    pushFrame(ctx, "skill", [prefix, seg.u(target.name), "の装備が疫病に蝕まれた！"], "skill", {
      [target.uid]: { type: "damage", value: "装備消去" },
    });
  }
  pushFrame(
    ctx,
    "skill",
    [
      prefix,
      seg.u(u.name),
      "が疫病を撒き散らす！ ",
      seg.u(target.name),
      "が",
      seg.e("感染"),
      "した。",
    ],
    "skill",
    {
      [u.uid]: { type: "skill" },
      [target.uid]: { type: "defend", value: "感染" },
    },
  );
}

export function applyCholeraBeforeAttack(
  board: BattleUnit[],
  targetArr: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  for (let i = 0; i < board.length; i++) {
    const u = board[i]!;
    if (u.id !== "cholera") continue;
    if (u.skillUses <= 0) continue;
    applyCholeraSkill({ u, targetArr, isPlayer, ctx });
    u.skillUses = 0;
  }
}

// ── 攻撃前スキルレジストリ ──

type BeforeAttackHandler = (args: BeforeAttackArgs) => void;

const BEFORE_ATTACK_HANDLERS = {
  parasite: ({ u, prefix, ctx }: BeforeAttackArgs) => applyParasiteBuff(u, prefix, ctx),
  eye: ({ u, enemyBoard, prefix, ctx }: BeforeAttackArgs) =>
    applyEyeGaze(u, enemyBoard, prefix, ctx),
  famine_corpse: ({ u, enemyBoard, prefix, ctx }: BeforeAttackArgs) =>
    applyFamineDebuff(u, enemyBoard, prefix, ctx),
  relic_sword: ({ u, board, prefix, ctx }: BeforeAttackArgs) =>
    applyRelicSwordBuff(u, board, prefix, ctx),
} satisfies Partial<Record<UnitId, BeforeAttackHandler>>;

type BeforeAttackUnitId = keyof typeof BEFORE_ATTACK_HANDLERS;

function getBeforeAttackHandler(id: UnitId): BeforeAttackHandler | undefined {
  return Object.hasOwn(BEFORE_ATTACK_HANDLERS, id)
    ? BEFORE_ATTACK_HANDLERS[id as BeforeAttackUnitId]
    : undefined;
}

export function applyBeforeAttackSkills(
  board: BattleUnit[],
  enemyBoard: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  if (board.length <= 1) return;
  const u = mustGet(board, SUPPORT_IDX, "before-attack board[SUPPORT_IDX]");
  const handler = getBeforeAttackHandler(u.id);
  if (!handler) return;
  const prefix = enemyPrefix(isPlayer);
  const mult = getMult(board, SUPPORT_IDX);

  for (let m = 0; m < mult; m++) {
    handler({ u, board, enemyBoard, prefix, ctx });
  }
}

export { applyOnHitSkills } from "./battle-skills-on-hit";

export { applyEquipmentEffects } from "./battle-equip";
