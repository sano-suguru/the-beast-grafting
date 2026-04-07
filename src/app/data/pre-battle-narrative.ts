import type { EnemyFaction, PreBattleText } from "../../shared/types";
import { toLifeTier } from "../../shared/types";
import { PRE_BATTLE_TEXTS } from "./pre-battle-texts";
import { invariant, mustGet } from "../../shared/invariant";

export function selectPreBattleNarrative(
  life: number,
  enemyType: EnemyFaction,
  round: number,
): PreBattleText {
  const tier = toLifeTier(life);
  const texts = PRE_BATTLE_TEXTS[tier][enemyType];
  invariant(texts != null && texts.length > 0, `missing pre-battle texts: ${tier}/${enemyType}`);

  /** 999th prime — round×life の組み合わせをテキストプールに均等分散させる */
  const HASH_PRIME = 7919;
  const seed = round * HASH_PRIME + life;
  const idx = Math.abs(seed | 0) % texts.length;
  return mustGet(texts, idx, `pre-battle text index out of bounds: ${idx}`);
}
