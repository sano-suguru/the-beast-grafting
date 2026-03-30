import type { BattleAction, UnitId } from "../types";
import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, getMult, enemyPrefix } from "./battle-context";
import { resolveDeaths } from "./battle-deaths";
import { mustGet } from "../invariant";
import {
  BAT_DAMAGE,
  BANSHEE_DAMAGE,
  EVANGELIST_HP_RATIO,
  PARASITE_BUFF,
  EYE_DAMAGE,
  REVENANT_MAX_TARGETS,
  BERSERK_BONUS,
  IRON_REDUCTION,
  CORPSE_WAX_REDUCTION,
  INFECTION_EXTRA_DAMAGE,
  NUMBNESS_REDUCTION,
  MIN_EQUIPMENT_DAMAGE,
  SUPPORT_IDX,
} from "./constants";

type SkillContext = {
  u: BattleUnit;
  targetArr: BattleUnit[];
  isPlayer: boolean;
  ctx: BattleContext;
};

type StartSkillHandler = (context: SkillContext) => void;

function applySkillDamage(
  u: BattleUnit,
  target: BattleUnit,
  dmg: number,
  msg: string,
  isPlayer: boolean,
  ctx: BattleContext,
) {
  target.hp -= dmg;
  const prefix = enemyPrefix(isPlayer);
  pushFrame(ctx, "skill", `${prefix}${msg}`, "skill", {
    [u.uid]: { type: "skill" },
    [target.uid]: { type: "damage", value: `-${dmg}` },
  });
  resolveDeaths(ctx);
}

function applyBatSkill({ u, targetArr, isPlayer, ctx }: SkillContext) {
  if (targetArr.length === 0) return;
  const target = mustGet(targetArr, Math.floor(ctx.rng.next() * targetArr.length), "bat target");
  applySkillDamage(
    u,
    target,
    BAT_DAMAGE,
    `[${u.name}]の先制攻撃！ [${target.name}]に ${BAT_DAMAGE} ダメージ。`,
    isPlayer,
    ctx,
  );
}

function applyBansheeSkill({ u, targetArr, isPlayer, ctx }: SkillContext) {
  const back = targetArr[targetArr.length - 1];
  if (!back) return;
  applySkillDamage(
    u,
    back,
    BANSHEE_DAMAGE,
    `[${u.name}]の呪殺の絶叫！ 最後尾の[${back.name}]に ${BANSHEE_DAMAGE} ダメージ。`,
    isPlayer,
    ctx,
  );
}

function applyEvangelistSkill({ u, targetArr, isPlayer, ctx }: SkillContext) {
  if (targetArr.length === 0) return;
  const first = mustGet(targetArr, 0, "evangelist target");
  let target: BattleUnit = first;
  targetArr.forEach((t) => {
    if (t.hp > target.hp) target = t;
  });
  const dmg = Math.floor(target.hp * EVANGELIST_HP_RATIO);
  applySkillDamage(
    u,
    target,
    dmg,
    `[${u.name}]の腐敗の祈り！ [${target.name}]の体力を奪う (-${dmg}HP)`,
    isPlayer,
    ctx,
  );
}

function applyCholeraSkill({ u, targetArr, isPlayer, ctx }: SkillContext) {
  if (targetArr.length === 0) return;
  const targetIdx = Math.floor(ctx.rng.next() * targetArr.length);
  const target = mustGet(targetArr, targetIdx, "cholera target");
  const prevEquip = target.equip;
  target.equip = "infection";
  const prefix = enemyPrefix(isPlayer);
  if (prevEquip && prevEquip !== "infection") {
    pushFrame(ctx, "skill", `${prefix}[${target.name}]の装備が疫病に蝕まれた！`, "skill", {
      [target.uid]: { type: "damage", value: "装備消去" },
    });
  }
  pushFrame(
    ctx,
    "skill",
    `${prefix}[${u.name}]が疫病を撒き散らす！ [${target.name}]が【感染】した。`,
    "skill",
    {
      [u.uid]: { type: "skill" },
      [target.uid]: { type: "defend", value: "感染" },
    },
  );
}

function applyRevenantSkill({ u, isPlayer, ctx }: SkillContext) {
  if (ctx.lastBattleResult !== "LOSE") return;
  const allyBoard = isPlayer ? ctx.pBoard : ctx.eBoard;
  const prefix = enemyPrefix(isPlayer);
  const actions: Record<string, BattleAction> = {
    [u.uid]: { type: "skill" },
  };
  let buffed = 0;
  for (const ally of allyBoard) {
    if (buffed >= REVENANT_MAX_TARGETS) break;
    if (ally.uid === u.uid) continue;
    ally.atk += 1;
    actions[ally.uid] = { type: "buff", value: "+1/+0" };
    buffed++;
  }
  if (buffed > 0) {
    pushFrame(
      ctx,
      "skill",
      `${prefix}[${u.name}]の怨嗟が燃え上がる！ 前方${buffed}体の攻撃力+1。`,
      "skill",
      actions,
    );
  }
}

const START_SKILL_HANDLERS = {
  bat: applyBatSkill,
  inquisitor: applyBatSkill,
  shrieking_throat: applyBansheeSkill,
  evangelist: applyEvangelistSkill,
  revenant: applyRevenantSkill,
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

export function applyCholeraBeforeAttack(
  board: BattleUnit[],
  targetArr: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  for (let i = 0; i < board.length; i++) {
    const u = board[i];
    if (!u || u.id !== "cholera") continue;
    if (u.skillUses <= 0) continue;
    applyCholeraSkill({ u, targetArr, isPlayer, ctx });
    u.skillUses = 0;
  }
}

export function applyBeforeAttackSkills(
  board: BattleUnit[],
  enemyBoard: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  if (board.length <= 1) return;
  const u = mustGet(board, SUPPORT_IDX, "before-attack board[SUPPORT_IDX]");
  const prefix = enemyPrefix(isPlayer);
  const mult = getMult(board, SUPPORT_IDX);

  for (let m = 0; m < mult; m++) {
    if (u.id === "parasite") {
      u.atk += PARASITE_BUFF.atk;
      u.hp += PARASITE_BUFF.hp;
      pushFrame(
        ctx,
        "skill",
        `${prefix}[${u.name}]が前衛の闘争に興奮する！ (+${PARASITE_BUFF.atk}/+${PARASITE_BUFF.hp})`,
        "skill",
        {
          [u.uid]: { type: "buff", value: `+${PARASITE_BUFF.atk}/+${PARASITE_BUFF.hp}` },
        },
      );
    }
    if (u.id === "eye" && enemyBoard.length > 0 && u.skillUses > 0) {
      const target = mustGet(
        enemyBoard,
        Math.floor(ctx.rng.next() * enemyBoard.length),
        "eye target",
      );
      target.hp -= EYE_DAMAGE;
      pushFrame(
        ctx,
        "skill",
        `${prefix}[${u.name}]の悪意の凝視！ [${target.name}]に ${EYE_DAMAGE} ダメージ。`,
        "skill",
        {
          [u.uid]: { type: "skill" },
          [target.uid]: { type: "damage", value: `-${EYE_DAMAGE}` },
        },
      );
      u.skillUses = u.skillUses - 1;
      resolveDeaths(ctx);
    }
  }
}

export function applyOnHitSkills(
  defender: BattleUnit,
  board: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  if (defender.hp <= 0) return;
  const idx = board.indexOf(defender);
  if (idx === -1) return;
  const prefix = enemyPrefix(isPlayer);
  const mult = getMult(board, idx);

  for (let m = 0; m < mult; m++) {
    if (defender.id === "templar") {
      defender.atk += 1;
      pushFrame(ctx, "skill", `${prefix}[${defender.name}]の信仰が深まる！ (+1/+0)`, "skill", {
        [defender.uid]: { type: "buff", value: "+1/+0" },
      });
    }
  }
}

function applyBerserkBonus(unit: BattleUnit, ctx: BattleContext, prefix: string): number {
  if (unit.equip !== "berserk") return 0;
  pushFrame(
    ctx,
    "skill",
    `${prefix}[${unit.name}]の【狂乱】！(攻撃ダメ+${BERSERK_BONUS})`,
    "skill",
    {
      [unit.uid]: { type: "skill" },
    },
  );
  return BERSERK_BONUS;
}

function applyDefensiveEquip(
  unit: BattleUnit,
  baseDmg: number,
  ctx: BattleContext,
  prefix: string,
): { dmg: number; action: BattleAction["type"] } {
  let dmg = baseDmg;
  let action: BattleAction["type"] = "damage";
  if (unit.equip === "iron") {
    dmg = Math.max(MIN_EQUIPMENT_DAMAGE, dmg - IRON_REDUCTION);
    action = "defend";
    pushFrame(
      ctx,
      "defend",
      `${prefix}[${unit.name}]の【鉄の皮膚】！(被ダメ-${IRON_REDUCTION})`,
      "defend",
      {
        [unit.uid]: { type: "defend" },
      },
    );
  }
  if (unit.equip === "corpse_wax") {
    dmg = Math.max(0, dmg - CORPSE_WAX_REDUCTION);
    unit.equip = null;
    action = "defend";
    pushFrame(
      ctx,
      "defend",
      `${prefix}[${unit.name}]の【屍蝋の盾】が破壊された！(${CORPSE_WAX_REDUCTION}軽減)`,
      "defend",
      {
        [unit.uid]: { type: "defend", value: `${CORPSE_WAX_REDUCTION}軽減` },
      },
    );
  }
  if (unit.equip === "infection") dmg += INFECTION_EXTRA_DAMAGE;
  if (unit.equip === "numbness") {
    const uses = unit.equipUses;
    if (uses > 0) {
      dmg = Math.max(MIN_EQUIPMENT_DAMAGE, dmg - NUMBNESS_REDUCTION);
      unit.equipUses = uses - 1;
      action = "defend";
      pushFrame(
        ctx,
        "defend",
        `${prefix}[${unit.name}]の【痛覚麻痺】！(被ダメ-${NUMBNESS_REDUCTION}, 残${uses - 1}回)`,
        "defend",
        {
          [unit.uid]: { type: "defend" },
        },
      );
      if (uses - 1 <= 0) {
        unit.equip = null;
      }
    }
  }
  return { dmg, action };
}

export function applyEquipmentEffects(
  p: BattleUnit,
  e: BattleUnit,
  ctx: BattleContext,
): { pDmg: number; eDmg: number; pAction: BattleAction["type"]; eAction: BattleAction["type"] } {
  const pBonus = applyBerserkBonus(p, ctx, "");
  const eBonus = applyBerserkBonus(e, ctx, "敵の");
  const pDef = applyDefensiveEquip(p, e.atk + eBonus, ctx, "");
  const eDef = applyDefensiveEquip(e, p.atk + pBonus, ctx, "敵の");
  return { pDmg: pDef.dmg, eDmg: eDef.dmg, pAction: pDef.action, eAction: eDef.action };
}
