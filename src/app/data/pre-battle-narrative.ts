import type { EnemyFaction, PreBattleText } from "../../shared/types";
import { toSanityTier } from "../../shared/types";
import { PRE_BATTLE_TEXTS } from "./pre-battle-texts";
import { invariant, mustGet } from "../../shared/invariant";

export function selectPreBattleNarrative(
  sanity: number,
  enemyType: EnemyFaction,
  round: number,
): PreBattleText {
  const tier = toSanityTier(sanity);
  const texts = PRE_BATTLE_TEXTS[tier][enemyType];
  invariant(texts != null && texts.length > 0, `missing pre-battle texts: ${tier}/${enemyType}`);

  const seed = round * 7919 + sanity;
  const idx = Math.abs(seed | 0) % texts.length;
  return mustGet(texts, idx, `pre-battle text index out of bounds: ${idx}`);
}
