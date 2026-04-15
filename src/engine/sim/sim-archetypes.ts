import type { RegularUnitId } from "../../shared/types";
import { optimizePositions } from "./sim-position";

/** 代表的な戦略アーキタイプ (全 RegularUnitId のみ) */
export const ARCHETYPES: Readonly<Record<string, readonly RegularUnitId[]>> = {
  spawn_cascade: ["altar", "plague_bell", "beast", "zealot", "beelzebub"],
  death_stack: ["insatiable_maw", "martyr", "sin_eater", "graft_scion", "crawling_cord"],
  debuff_control: ["famine_corpse", "evangelist", "cholera", "shrieking_throat", "organ_grinder"],
  tank_sustain: ["howling_giant", "machine", "amniotic_armor", "tumor_guardian", "hundred_arms"],
  support_stack: ["parasite", "eye", "brains", "amniotic_armor", "plague_bell"],
  avenge_ramp: ["dead_hand", "rat", "charnel_pit", "wailing_cursechild", "grinning_skull"],
  mimicking_combo: ["hundred_arms", "parasite", "mimicking_flesh", "blood_font", "corroding_mold"],
  value_trade: ["devouring_graft", "charnel_pit", "flayed_saint", "stellar_cocoon", "omen_womb"],
  machine_sustain: ["howling_giant", "machine", "brains", "leech", "tumor_guardian"],
  hydra_swarm: ["budding_hydra", "tumor_guardian", "altar", "crawling_cord", "insatiable_maw"],
};

/** 各アーキタイプにポジション最適化を適用して返す */
export function getPositionedArchetypes(): ReadonlyMap<string, readonly RegularUnitId[]> {
  const result = new Map<string, readonly RegularUnitId[]>();
  for (const [name, ids] of Object.entries(ARCHETYPES)) {
    result.set(name, optimizePositions(ids));
  }
  return result;
}
