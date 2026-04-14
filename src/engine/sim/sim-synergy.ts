import type { RegularUnitId } from "../../shared/types";
import type { UnitSimProfile, SynergyTag } from "./sim-types";

const SYNERGY_BOOST = 3;

/** 全60体の RegularUnitId に対するシミュレーション用プロファイル */
export const UNIT_PROFILES: Readonly<Record<RegularUnitId, UnitSimProfile>> = {
  // ── Tier 1 ──
  rat: { role: "flex", tags: ["death-provider"] },
  beggar: { role: "flex", tags: ["stat-stick"] },
  hound: { role: "flex", tags: ["spawner", "death-provider"] },
  bat: { role: "flex", tags: ["self-contained"] },
  zealot: { role: "flex", tags: ["spawn-reactor"] },
  grave_worm: { role: "flex", tags: ["stat-stick"] },
  leech: { role: "front", tags: ["self-contained"] },
  crow: { role: "flex", tags: ["death-reactor"] },
  ghoul_infant: { role: "flex", tags: ["stat-stick"] },
  dead_hand: { role: "front", tags: ["self-contained"] },

  // ── Tier 2 ──
  martyr: { role: "flex", tags: ["death-provider"] },
  beast: { role: "flex", tags: ["spawner", "death-provider"] },
  cholera: { role: "support", tags: ["self-contained"] },
  catacomb_rat: { role: "flex", tags: ["self-contained"] },
  stitched_twin: { role: "front", tags: ["self-contained"] },
  market_vulture: { role: "flex", tags: ["stat-stick"] },
  devouring_wound: { role: "front", tags: ["self-contained"] },
  crawling_cord: { role: "flex", tags: ["death-reactor"] },
  tainted_placenta: { role: "flex", tags: ["stat-stick"] },
  graft_scion: { role: "flex", tags: ["death-provider"] },

  // ── Tier 3 ──
  parasite: { role: "support", tags: ["front-synergy"] },
  maiden: { role: "flex", tags: ["death-provider"] },
  revenant: { role: "flex", tags: ["self-contained"] },
  flayed_saint: { role: "front", tags: ["self-contained"] },
  charnel_pit: { role: "flex", tags: ["spawner", "avenge"] },
  famine_corpse: { role: "support", tags: ["self-contained"] },
  flesh_granulation: { role: "flex", tags: ["spawn-reactor"] },
  corroding_mold: { role: "flex", tags: ["front-synergy"] },
  omen_womb: { role: "flex", tags: ["spawner", "death-provider"] },
  corpse_broker: { role: "flex", tags: ["stat-stick"] },

  // ── Tier 4 ──
  evangelist: { role: "flex", tags: ["death-reactor"] },
  altar: { role: "flex", tags: ["spawn-reactor"] },
  machine: { role: "support", tags: ["front-synergy"] },
  sin_eater: { role: "flex", tags: ["death-reactor"] },
  blood_font: { role: "flex", tags: ["front-synergy"] },
  ash_fungus: { role: "flex", tags: ["stat-stick"] },
  devouring_graft: { role: "flex", tags: ["front-synergy"] },
  tumor_guardian: { role: "front", tags: ["self-contained"] },
  groaning_coffin: { role: "flex", tags: ["avenge"] },
  stellar_cocoon: { role: "flex", tags: ["spawner", "death-provider"] },

  // ── Tier 5 ──
  shrieking_throat: { role: "flex", tags: ["self-contained"] },
  hundred_arms: { role: "front", tags: ["self-contained"] },
  chalice: { role: "flex", tags: ["stat-stick"] },
  plague_bell: { role: "support", tags: ["self-contained"] },
  hanged_man: { role: "flex", tags: ["death-provider"] },
  necrotic_finger: { role: "front", tags: ["self-contained"] },
  insatiable_maw: { role: "flex", tags: ["death-reactor"] },
  wailing_cursechild: { role: "flex", tags: ["avenge"] },
  amniotic_armor: { role: "front", tags: ["self-contained"] },
  mimicking_flesh: { role: "flex", tags: ["multiplier"] },

  // ── Tier 6 ──
  brains: { role: "flex", tags: ["multiplier"] },
  eye: { role: "support", tags: ["self-contained"] },
  beelzebub: { role: "flex", tags: ["death-reactor", "spawner"] },
  rot_ring: { role: "flex", tags: ["stat-stick"] },
  organ_grinder: { role: "front", tags: ["self-contained"] },
  grinning_skull: { role: "flex", tags: ["avenge"] },
  puppeteer: { role: "flex", tags: ["multiplier"] },
  corpse_garden: { role: "flex", tags: ["spawner"] },
  bone_tree: { role: "flex", tags: ["stat-stick"] },
  howling_giant: { role: "front", tags: ["self-contained"] },
};

const AFFINITY_PAIRS = new Set([
  "spawner:spawn-reactor",
  "spawn-reactor:spawner",
  "death-provider:death-reactor",
  "death-reactor:death-provider",
  "death-provider:avenge",
  "avenge:death-provider",
]);

const MULTIPLIER_EXCLUDED: ReadonlySet<SynergyTag> = new Set(["stat-stick", "multiplier"]);

/** 2つのタグ間にシナジー親和性があるか判定 */
function hasAffinity(candidate: SynergyTag, existing: SynergyTag): boolean {
  if (AFFINITY_PAIRS.has(`${candidate}:${existing}`)) return true;
  if (candidate === "multiplier" && !MULTIPLIER_EXCLUDED.has(existing)) return true;
  if (existing === "multiplier" && !MULTIPLIER_EXCLUDED.has(candidate)) return true;
  return false;
}

/**
 * 候補ユニットのタグと既選択チームのタグを照合し、
 * いずれかのペアに親和性があれば SYNERGY_BOOST を返す。スタックしない。
 */
export function computeSynergyWeight(
  candidateTags: readonly SynergyTag[],
  existingTags: readonly SynergyTag[],
): number {
  for (const ct of candidateTags) {
    for (const et of existingTags) {
      if (hasAffinity(ct, et)) return SYNERGY_BOOST;
    }
  }
  return 1;
}
