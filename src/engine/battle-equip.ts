import type { BattleUnit, BattleContext, ClashActionType } from "./battle-context";
import { pushFrame, enemyPrefix, seg, skillAction, defendAction } from "./battle-context";
import {
  BERSERK_BONUS,
  IRON_REDUCTION,
  CORPSE_WAX_REDUCTION,
  INFECTION_DAMAGE,
  NUMBNESS_REDUCTION,
  MIN_EQUIPMENT_DAMAGE,
} from "./constants";

interface DefenseResult {
  dmg: number;
  action: ClashActionType;
  waxBlocked?: true;
}

function applyBerserkBonus(unit: BattleUnit, ctx: BattleContext, isPlayer: boolean): number {
  if (unit.equip !== "berserk") return 0;
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    () => [
      prefix,
      seg.u(unit.name),
      "が荒ぶる！",
      seg.e("狂乱"),
      seg.s(`攻撃ダメ+${BERSERK_BONUS}`),
    ],
    "skill",
    { [unit.uid]: skillAction() },
  );
  return BERSERK_BONUS;
}

function applyInfectionPenalty(
  unit: BattleUnit,
  baseDmg: number,
  prefix: string,
  ctx: BattleContext,
): DefenseResult {
  const lvl = Math.max(0, Math.min(unit.infectionLevel - 1, 2));
  const extra = INFECTION_DAMAGE[lvl] ?? INFECTION_DAMAGE[0]!;
  pushFrame(
    ctx,
    "defend",
    () => [prefix, seg.u(unit.name), "の傷が膿む。", seg.e("感染"), seg.s(`被ダメ+${extra}`)],
    "defend",
    { [unit.uid]: { type: "damage" } },
  );
  return { dmg: baseDmg + extra, action: "damage" };
}

function applyIronDefense(
  unit: BattleUnit,
  dmg: number,
  prefix: string,
  ctx: BattleContext,
): DefenseResult {
  const reduced = Math.max(MIN_EQUIPMENT_DAMAGE, dmg - IRON_REDUCTION);
  pushFrame(
    ctx,
    "defend",
    () => [prefix, "刃が弾かれる。", seg.e("鉄の皮膚"), seg.s(`被ダメ-${IRON_REDUCTION}`)],
    "defend",
    { [unit.uid]: defendAction() },
  );
  return { dmg: reduced, action: "defend" };
}

function applyCorpseWaxDefense(
  unit: BattleUnit,
  dmg: number,
  prefix: string,
  ctx: BattleContext,
): DefenseResult {
  const reduced = Math.max(0, dmg - CORPSE_WAX_REDUCTION);
  unit.equip = null;
  pushFrame(
    ctx,
    "defend",
    () => [
      prefix,
      seg.u(unit.name),
      "の",
      seg.e("屍蝋の盾"),
      "が破壊された！",
      seg.s(`${CORPSE_WAX_REDUCTION}軽減`),
    ],
    "defend",
    { [unit.uid]: defendAction(`${CORPSE_WAX_REDUCTION}軽減`) },
  );
  return { dmg: reduced, action: "defend", waxBlocked: true };
}

function applyNumbnessDefense(
  unit: BattleUnit,
  dmg: number,
  prefix: string,
  ctx: BattleContext,
): DefenseResult {
  const uses = unit.equipUses;
  if (uses <= 0) return { dmg, action: "damage" };
  const reduced = Math.max(MIN_EQUIPMENT_DAMAGE, dmg - NUMBNESS_REDUCTION);
  unit.equipUses = uses - 1;
  pushFrame(
    ctx,
    "defend",
    () => [
      prefix,
      seg.u(unit.name),
      "は怯まない。",
      seg.e("痛覚麻痺"),
      seg.s(`被ダメ-${NUMBNESS_REDUCTION}, 残${uses - 1}回`),
    ],
    "defend",
    { [unit.uid]: defendAction() },
  );
  if (uses - 1 <= 0) unit.equip = null;
  return { dmg: reduced, action: "defend" };
}

function applyDefensiveEquip(
  unit: BattleUnit,
  baseDmg: number,
  ctx: BattleContext,
  isPlayer: boolean,
): DefenseResult {
  const prefix = enemyPrefix(isPlayer);
  if (unit.equip === "iron") return applyIronDefense(unit, baseDmg, prefix, ctx);
  if (unit.equip === "corpse_wax") return applyCorpseWaxDefense(unit, baseDmg, prefix, ctx);
  if (unit.equip === "infection") return applyInfectionPenalty(unit, baseDmg, prefix, ctx);
  if (unit.equip === "numbness") return applyNumbnessDefense(unit, baseDmg, prefix, ctx);
  return { dmg: baseDmg, action: "damage" };
}

interface EquipmentResult {
  pDmg: number;
  eDmg: number;
  pAction: ClashActionType;
  eAction: ClashActionType;
  pWaxBlocked: boolean;
  eWaxBlocked: boolean;
}

export function applyEquipmentEffects(
  p: BattleUnit,
  e: BattleUnit,
  ctx: BattleContext,
): EquipmentResult {
  const pBonus = applyBerserkBonus(p, ctx, true);
  const eBonus = applyBerserkBonus(e, ctx, false);
  const pDef = applyDefensiveEquip(p, e.atk + eBonus, ctx, true);
  const eDef = applyDefensiveEquip(e, p.atk + pBonus, ctx, false);
  return {
    pDmg: pDef.dmg,
    eDmg: eDef.dmg,
    pAction: pDef.action,
    eAction: eDef.action,
    pWaxBlocked: pDef.waxBlocked === true,
    eWaxBlocked: eDef.waxBlocked === true,
  };
}
