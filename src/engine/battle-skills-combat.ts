import type { UnitId } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import {
  pushFrame,
  getMult,
  takeDamage,
  enemyPrefix,
  seg,
  aoeDamageActions,
  aoeBuffActions,
  healAction,
  damageAction,
  skillAction,
} from "./battle-context";
import { resolveDeaths } from "./battle-deaths";
import { mustGet } from "../shared/invariant";
import { HUNDRED_ARMS_SAFETY, ACID_SPLASH_DAMAGE } from "./constants";
import {
  atLevel,
  DEAD_HAND,
  DEVOURING_WOUND,
  HUNDRED_ARMS,
  ORGAN_GRINDER,
  RISEN_POPE,
} from "../shared/skill-params";

export function applyAcidSplash(
  attacker: BattleUnit,
  targetBoard: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  if (attacker.equip !== "acid" || targetBoard.length <= 1) return;
  const splashTarget = mustGet(targetBoard, 1, "acid splash target");
  const hpBefore = splashTarget.hp;
  takeDamage(splashTarget, ACID_SPLASH_DAMAGE, attacker.uid);
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    [
      prefix,
      seg.u(attacker.name),
      "から",
      seg.e("酸の血液"),
      "が飛び散る！ ",
      seg.u(splashTarget.name),
      "に ",
      seg.hp(`${hpBefore}→${Math.max(0, splashTarget.hp)}`),
    ],
    "skill",
    {
      [attacker.uid]: skillAction(),
      [splashTarget.uid]: damageAction(ACID_SPLASH_DAMAGE, attacker.uid),
    },
  );
  resolveDeaths(ctx);
}

type KnockoutContext = {
  attacker: BattleUnit;
  defenderBoard: BattleUnit[];
  attackerBoard: BattleUnit[];
  isPlayer: boolean;
  ctx: BattleContext;
};

type KnockoutHandler = (k: KnockoutContext) => void;

const KNOCKOUT_HANDLERS = {
  dead_hand: (k) => processDeadHandKnockout(k.attacker, k.attackerBoard, k.isPlayer, k.ctx),
  devouring_wound: (k) =>
    processDevouringWoundKnockout(k.attacker, k.attackerBoard, k.isPlayer, k.ctx),
  hundred_arms: (k) =>
    processHundredArmsKnockout(k.attacker, k.defenderBoard, k.attackerBoard, k.isPlayer, k.ctx),
  organ_grinder: (k) =>
    processOrganGrinderKnockout(k.attacker, k.defenderBoard, k.attackerBoard, k.isPlayer, k.ctx),
  risen_pope: (k) => processRisenPopeKnockout(k.attacker, k.attackerBoard, k.isPlayer, k.ctx),
} satisfies Partial<Record<UnitId, KnockoutHandler>>;

type KnockoutUnitId = keyof typeof KNOCKOUT_HANDLERS;

function getKnockoutHandler(id: UnitId): KnockoutHandler | undefined {
  return Object.hasOwn(KNOCKOUT_HANDLERS, id) ? KNOCKOUT_HANDLERS[id as KnockoutUnitId] : undefined;
}

export function processKnockoutEffects(
  attacker: BattleUnit,
  defenderBoard: BattleUnit[],
  attackerBoard: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  const handler = getKnockoutHandler(attacker.id);
  if (handler) handler({ attacker, defenderBoard, attackerBoard, isPlayer, ctx });
}

function getKnockoutMult(unit: BattleUnit, id: UnitId, board: BattleUnit[]): number {
  if (unit.id !== id || unit.hp <= 0) return 0;
  const idx = board.indexOf(unit);
  return idx === -1 ? 0 : getMult(board, idx);
}

function processDeadHandKnockout(
  attacker: BattleUnit,
  attackerBoard: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  const mult = getKnockoutMult(attacker, "dead_hand", attackerBoard);
  if (mult === 0) return;
  const prefix = enemyPrefix(isPlayer);
  for (let m = 0; m < mult; m++) {
    const heal = atLevel(DEAD_HAND.hpHeal, attacker.level);
    attacker.hp += heal;
    pushFrame(
      ctx,
      "skill",
      [prefix, seg.u(attacker.name), "が死肉を掴む。少し膨れる。", seg.s(`+0/+${heal}`)],
      "skill",
      { [attacker.uid]: healAction(heal, attacker.uid) },
    );
  }
}

function processDevouringWoundKnockout(
  attacker: BattleUnit,
  attackerBoard: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  const mult = getKnockoutMult(attacker, "devouring_wound", attackerBoard);
  if (mult === 0) return;
  const prefix = enemyPrefix(isPlayer);
  for (let m = 0; m < mult; m++) {
    const heal = atLevel(DEVOURING_WOUND.hpHeal, attacker.level);
    attacker.hp += heal;
    pushFrame(
      ctx,
      "skill",
      [prefix, seg.u(attacker.name), "が塞がり、また開く。", seg.s(`+0/+${heal}`)],
      "skill",
      { [attacker.uid]: healAction(heal, attacker.uid) },
    );
  }
}

function processOrganGrinderKnockout(
  attacker: BattleUnit,
  defenderBoard: BattleUnit[],
  attackerBoard: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  const mult = getKnockoutMult(attacker, "organ_grinder", attackerBoard);
  if (mult === 0) return;
  const prefix = enemyPrefix(isPlayer);
  for (let m = 0; m < mult; m++) {
    const dmg = atLevel(ORGAN_GRINDER.damage, attacker.level);
    const hit: BattleUnit[] = [];
    for (const target of defenderBoard) {
      if (target.hp <= 0) continue;
      takeDamage(target, dmg, attacker.uid);
      hit.push(target);
    }
    pushFrame(
      ctx,
      "skill",
      [prefix, seg.u(attacker.name), "が肉を挽く！ 敵全体に", seg.s(`${dmg}ダメージ`)],
      "skill",
      aoeDamageActions(attacker, hit, dmg),
    );
    resolveDeaths(ctx);
  }
}

function processRisenPopeKnockout(
  attacker: BattleUnit,
  attackerBoard: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  const mult = getKnockoutMult(attacker, "risen_pope", attackerBoard);
  if (mult === 0) return;
  const prefix = enemyPrefix(isPlayer);
  for (let m = 0; m < mult; m++) {
    const b = atLevel(RISEN_POPE.buff, attacker.level);
    const buffed: BattleUnit[] = [];
    for (const ally of attackerBoard) {
      if (ally.hp <= 0) continue;
      ally.atk += b.atk;
      ally.hp += b.hp;
      buffed.push(ally);
    }
    pushFrame(
      ctx,
      "skill",
      [
        prefix,
        seg.u(attacker.name),
        "が血塗れの槌を掲げる。味方の目に狂気の光が灯る。",
        seg.s(`+${b.atk}/+${b.hp}`),
      ],
      "skill",
      aoeBuffActions(attacker, buffed, b),
    );
  }
}

export function processHundredArmsKnockout(
  attacker: BattleUnit,
  defenderBoard: BattleUnit[],
  attackerBoard: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  if (attacker.id !== "hundred_arms" || attacker.hp <= 0) return;
  const attackerIdx = attackerBoard.indexOf(attacker);
  if (attackerIdx === -1) return;
  const mult = getMult(attackerBoard, attackerIdx);
  const prefix = enemyPrefix(isPlayer);

  for (let m = 0; m < mult; m++) {
    let safety = 0;
    while (defenderBoard.length > 0 && safety < HUNDRED_ARMS_SAFETY) {
      safety++;
      const target = mustGet(defenderBoard, 0, "hundred_arms target");
      const dmg =
        target.tier === 1
          ? atLevel(HUNDRED_ARMS.damageT1, attacker.level)
          : atLevel(HUNDRED_ARMS.damageDefault, attacker.level);
      const hpBefore = target.hp;
      takeDamage(target, dmg, attacker.uid);
      pushFrame(
        ctx,
        "skill",
        [
          prefix,
          seg.u(attacker.name),
          "の無数の拳が",
          seg.u(target.name),
          "を叩き潰す！ ",
          seg.hp(`${hpBefore}→${Math.max(0, target.hp)}`),
          ...(target.tier === 1 ? [seg.s("脆い肉ほど容易く千切れる")] : []),
        ],
        "skill",
        {
          [attacker.uid]: skillAction(),
          [target.uid]: damageAction(dmg, attacker.uid),
        },
      );
      if (target.hp <= 0) {
        resolveDeaths(ctx);
        continue;
      }
      break;
    }
  }
}
