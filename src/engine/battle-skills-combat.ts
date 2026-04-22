import type { UnitId } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import {
  pushFrame,
  runWithBrainsRepeat,
  takeDamage,
  enemyPrefix,
  seg,
  aoeBuffActions,
  buffAction,
  damageAction,
  skillAction,
} from "./battle-context";
import { resolveDeaths } from "./battle-deaths";
import { buffAllAlive } from "./battle-context";
import { mustGet } from "../shared/invariant";
import { HUNDRED_ARMS_SAFETY, ACID_SPLASH_DAMAGE } from "./constants";
import { atLevel, HUNDRED_ARMS, RISEN_POPE, SIN_EATER } from "../shared/skill-params";
import type { Scaled, Buff } from "../shared/skill-params";

function runKnockoutSkill(
  attacker: BattleUnit,
  attackerBoard: BattleUnit[],
  expectedId: UnitId,
  isPlayer: boolean,
  fn: (prefix: string) => void,
) {
  if (attacker.id !== expectedId || attacker.hp <= 0) return;
  const idx = attackerBoard.indexOf(attacker);
  if (idx === -1) return;
  const prefix = enemyPrefix(isPlayer);
  runWithBrainsRepeat(attacker, attackerBoard, idx, () => fn(prefix));
}

export function applyAcidSplash(
  attacker: BattleUnit,
  targetBoard: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  if (attacker.equip !== "acid_blood" || targetBoard.length <= 1) return;
  const splashTarget = mustGet(targetBoard, 1, "acid splash target");
  const hpBefore = splashTarget.hp;
  takeDamage(splashTarget, ACID_SPLASH_DAMAGE, ctx, attacker.uid);
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    () => [
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
  hundred_arms: (k) =>
    processHundredArmsKnockout(k.attacker, k.defenderBoard, k.attackerBoard, k.isPlayer, k.ctx),
  risen_pope: (k) => processRisenPopeKnockout(k.attacker, k.attackerBoard, k.isPlayer, k.ctx),
  sin_eater: (k) => processSinEaterKnockout(k.attacker, k.attackerBoard, k.isPlayer, k.ctx),
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

function runBuffKnockout(
  attacker: BattleUnit,
  attackerBoard: BattleUnit[],
  unitId: UnitId,
  isPlayer: boolean,
  ctx: BattleContext,
  opts: {
    buffParam: Scaled<Buff>;
    target: "self" | "all";
    narrative: string;
  },
) {
  runKnockoutSkill(attacker, attackerBoard, unitId, isPlayer, (prefix) => {
    const b = atLevel(opts.buffParam, attacker.level);
    const actions =
      opts.target === "self"
        ? { [attacker.uid]: buffAction(b, attacker.uid) }
        : aoeBuffActions(attacker, buffAllAlive(attackerBoard, b), b);
    if (opts.target === "self") {
      attacker.atk += b.atk;
      attacker.hp += b.hp;
    }
    pushFrame(
      ctx,
      "skill",
      () => [prefix, seg.u(attacker.name), opts.narrative, seg.s(`+${b.atk}/+${b.hp}`)],
      "skill",
      actions,
    );
  });
}

function processSinEaterKnockout(
  attacker: BattleUnit,
  attackerBoard: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  runBuffKnockout(attacker, attackerBoard, "sin_eater", isPlayer, ctx, {
    buffParam: SIN_EATER.buff,
    target: "self",
    narrative: "が屍を喰らい、殻が膨れる。",
  });
}

function processRisenPopeKnockout(
  attacker: BattleUnit,
  attackerBoard: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  runBuffKnockout(attacker, attackerBoard, "risen_pope", isPlayer, ctx, {
    buffParam: RISEN_POPE.buff,
    target: "all",
    narrative: "が血塗れの槌を掲げる。味方の目に狂気の光が灯る。",
  });
}

export function processHundredArmsKnockout(
  attacker: BattleUnit,
  defenderBoard: BattleUnit[],
  attackerBoard: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  runKnockoutSkill(attacker, attackerBoard, "hundred_arms", isPlayer, (prefix) => {
    let safety = 0;
    while (defenderBoard.length > 0 && safety < HUNDRED_ARMS_SAFETY) {
      safety++;
      const target = mustGet(defenderBoard, 0, "hundred_arms target");
      const dmg =
        target.tier === 1
          ? atLevel(HUNDRED_ARMS.damageT1, attacker.level)
          : atLevel(HUNDRED_ARMS.damageDefault, attacker.level);
      const hpBefore = target.hp;
      takeDamage(target, dmg, ctx, attacker.uid);
      pushFrame(
        ctx,
        "skill",
        () => [
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
  });
}
