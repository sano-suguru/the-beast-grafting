import type { BattleUnit, BattleContext } from "./battle-context";
import { pushFrame, getMult, enemyPrefix } from "./battle-context";
import { resolveDeaths } from "./battle-deaths";
import { mustGet } from "../../shared/invariant";
import {
  ACID_SPLASH_DAMAGE,
  HUNDRED_ARMS_T1_DAMAGE,
  HUNDRED_ARMS_DEFAULT_DAMAGE,
  HUNDRED_ARMS_SAFETY,
} from "./constants";

export function applyAcidSplash(
  attacker: BattleUnit,
  targetBoard: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
) {
  if (attacker.equip !== "acid" || targetBoard.length <= 1) return;
  const splashTarget = mustGet(targetBoard, 1, "acid splash target");
  splashTarget.hp -= ACID_SPLASH_DAMAGE;
  const prefix = enemyPrefix(isPlayer);
  const msg = `${prefix}[${attacker.name}]の【酸の血液】が飛散！ [${splashTarget.name}]に ${ACID_SPLASH_DAMAGE} ダメージ。`;
  pushFrame(ctx, "skill", msg, "skill", {
    [attacker.uid]: { type: "skill" },
    [splashTarget.uid]: { type: "damage", value: `-${ACID_SPLASH_DAMAGE}` },
  });
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
      const dmg = target.tier === 1 ? HUNDRED_ARMS_T1_DAMAGE : HUNDRED_ARMS_DEFAULT_DAMAGE;
      target.hp -= dmg;
      pushFrame(
        ctx,
        "skill",
        `${prefix}[${attacker.name}]の蹂躙！ [${target.name}]に ${dmg} ダメージ${target.tier === 1 ? "(Tier1倍打)" : ""}`,
        "skill",
        {
          [attacker.uid]: { type: "skill" },
          [target.uid]: { type: "damage", value: `-${dmg}` },
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
