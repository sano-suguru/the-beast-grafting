import type { UnitId } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import { getMult, enemyPrefix } from "./battle-context";
import { mustGet } from "../shared/invariant";
import { SUPPORT_IDX } from "./constants";
import type { SkillContext, BeforeAttackArgs } from "./battle-skills-util";
import { applyNeedleshellWormAfterAttack } from "./battle-skills-after-attack";
import {
  applyBatSkill,
  applyInquisitorSkill,
  applyBansheeSkill,
  applyRevenantSkill,
  applyPaladinSkill,
  applyHolyFireSkill,
  applyMarketVultureSkill,
} from "./battle-skills-start";
import {
  applyDevouringGraftSkill,
  applyCorrodingMoldSkill,
  applyMimickingFleshSkill,
} from "./battle-skills-start-pred";
import {
  applyParasiteBuff,
  applyEyeGaze,
  applyFamineDebuff,
  applyRelicSwordBuff,
  applyPlagueBellToll,
  applyMachineTransfusion,
  applyCrawlingCordBuff,
} from "./battle-skills-before-attack";

// ── 開戦スキルレジストリ ──

type StartSkillHandler = (context: SkillContext) => void;

const START_SKILL_HANDLERS = {
  bat: applyBatSkill,
  church_inquisitor: applyInquisitorSkill,
  shrieking_throat: applyBansheeSkill,
  revenant: applyRevenantSkill,
  market_vulture: applyMarketVultureSkill,
  paladin: applyPaladinSkill,
  holy_fire: applyHolyFireSkill,
  devouring_graft: applyDevouringGraftSkill,
  corroding_mold: applyCorrodingMoldSkill,
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
  const snapshot = [...boardArr];
  for (const u of snapshot) {
    if (!boardArr.includes(u)) continue;
    const idx = boardArr.indexOf(u);
    const mult = getMult(boardArr, idx);
    if (u.id === "mimicking_flesh") {
      applyMimickingFleshSkill({ u, targetArr, isPlayer, ctx }, getStartSkillHandler);
      for (let m = 1; m < mult; m++) {
        const copied = getStartSkillHandler(u.id);
        if (copied) copied({ u, targetArr, isPlayer, ctx });
      }
      continue;
    }
    const handler = getStartSkillHandler(u.id);
    if (!handler) continue;
    for (let m = 0; m < mult; m++) {
      handler({ u, targetArr, isPlayer, ctx });
    }
  }
}

// ── 攻撃前スキルレジストリ ──

type BeforeAttackHandler = (args: BeforeAttackArgs) => void;

const BEFORE_ATTACK_HANDLERS = {
  parasite: ({ u, prefix, ctx }: BeforeAttackArgs) => applyParasiteBuff(u, prefix, ctx),
  crawling_cord: ({ u, prefix, ctx }: BeforeAttackArgs) => applyCrawlingCordBuff(u, prefix, ctx),
  eye: ({ u, enemyBoard, prefix, ctx }: BeforeAttackArgs) =>
    applyEyeGaze(u, enemyBoard, prefix, ctx),
  famine_corpse: ({ u, enemyBoard, prefix, ctx }: BeforeAttackArgs) =>
    applyFamineDebuff(u, enemyBoard, prefix, ctx),
  relic_sword: ({ u, board, prefix, ctx }: BeforeAttackArgs) =>
    applyRelicSwordBuff(u, board, prefix, ctx),
  plague_bell: ({ u, enemyBoard, prefix, ctx }: BeforeAttackArgs) =>
    applyPlagueBellToll(u, enemyBoard, prefix, ctx),
  machine: ({ u, board, prefix, ctx }: BeforeAttackArgs) =>
    applyMachineTransfusion(u, board, prefix, ctx),
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

// ── 攻撃後スキルレジストリ ──

type AfterAttackArgs = BeforeAttackArgs & { isPlayer: boolean };

type AfterAttackHandler = (args: AfterAttackArgs) => void;

const AFTER_ATTACK_HANDLERS = {
  needleshell_worm: ({ u, board, isPlayer, prefix, ctx }: AfterAttackArgs) =>
    applyNeedleshellWormAfterAttack(u, board, isPlayer, prefix, ctx),
} satisfies Partial<Record<UnitId, AfterAttackHandler>>;

type AfterAttackUnitId = keyof typeof AFTER_ATTACK_HANDLERS;

function getAfterAttackHandler(id: UnitId): AfterAttackHandler | undefined {
  return Object.hasOwn(AFTER_ATTACK_HANDLERS, id)
    ? AFTER_ATTACK_HANDLERS[id as AfterAttackUnitId]
    : undefined;
}

export function applyAfterAttackSkills(
  attacker: BattleUnit,
  board: BattleUnit[],
  enemyBoard: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  const handler = getAfterAttackHandler(attacker.id);
  if (!handler) return;
  const prefix = enemyPrefix(isPlayer);
  const mult = getMult(board, 0);
  for (let m = 0; m < mult; m++) {
    handler({ u: attacker, board, enemyBoard, isPlayer, prefix, ctx });
  }
}
