import type { RegularUnitId } from "../../shared/types";
import { optimizePositions } from "./sim-position";

/** 代表的な戦略アーキタイプ (全 RegularUnitId のみ) */
export const ARCHETYPES: Readonly<Record<string, readonly RegularUnitId[]>> = {
  spawn_cascade: ["altar", "hound", "beast", "zealot", "beelzebub"],
  death_stack: ["insatiable_maw", "martyr", "sin_eater", "graft_scion", "crawling_cord"],
  debuff_control: ["famine_corpse", "evangelist", "cholera", "shrieking_throat", "organ_grinder"],
  tank_sustain: ["howling_giant", "amniotic_armor", "tumor_guardian", "leech", "hundred_arms"],
  support_stack: ["parasite", "eye", "brains", "corroding_mold", "plague_bell"],
};

/** 各アーキタイプにポジション最適化を適用して返す */
export function getPositionedArchetypes(): ReadonlyMap<string, readonly RegularUnitId[]> {
  const result = new Map<string, readonly RegularUnitId[]>();
  for (const [name, ids] of Object.entries(ARCHETYPES)) {
    result.set(name, optimizePositions(ids));
  }
  return result;
}
