import { createSeededRng } from "./rng";
import type { SanityTier, EnemyFaction, PreBattleText } from "../types";
import { PRE_BATTLE_TEXTS } from "../data/pre-battle-texts";
import { invariant, mustGet } from "../invariant";

export function toSanityTier(sanity: number): SanityTier {
  if (sanity >= 4) return "high";
  if (sanity >= 2) return "mid";
  return "low";
}

export function selectPreBattleNarrative(
  sanity: number,
  enemyType: EnemyFaction,
  round: number,
): PreBattleText {
  const tier = toSanityTier(sanity);
  const texts = PRE_BATTLE_TEXTS[tier][enemyType];
  invariant(texts != null && texts.length > 0, `missing pre-battle texts: ${tier}/${enemyType}`);

  const rng = createSeededRng(round * 7919 + sanity);
  const idx = Math.floor(rng.next() * texts.length);
  return mustGet(texts, idx, `pre-battle text index out of bounds: ${idx}`);
}
