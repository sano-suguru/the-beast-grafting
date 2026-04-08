import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, getMult, enemyPrefix, seg } from "./battle-context";
import { resolveDeaths } from "./battle-deaths";
import { mustGet } from "../shared/invariant";
import { HUNDRED_ARMS_SAFETY, ACID_SPLASH_DAMAGE } from "./constants";
import { atLevel, HUNDRED_ARMS } from "../shared/skill-params";

export function applyAcidSplash(
  attacker: BattleUnit,
  targetBoard: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  if (attacker.equip !== "acid" || targetBoard.length <= 1) return;
  const splashTarget = mustGet(targetBoard, 1, "acid splash target");
  const hpBefore = splashTarget.hp;
  splashTarget.hp -= ACID_SPLASH_DAMAGE;
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
      [attacker.uid]: { type: "skill" },
      [splashTarget.uid]: { type: "damage", value: `-${ACID_SPLASH_DAMAGE}`, source: attacker.uid },
    },
  );
  resolveDeaths(ctx);
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
      target.hp -= dmg;
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
          [attacker.uid]: { type: "skill" },
          [target.uid]: { type: "damage", value: `-${dmg}`, source: attacker.uid },
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
