import type { DataUnitId } from "../../shared/types";
import type { Tier } from "../../shared/data/tiers";
import { createUnit } from "../helpers";
import { atLevel } from "../../shared/skill-params";
import { TAINTED_PLACENTA } from "../../shared/skill-params-shop";
import { estimateOwnedTurns, STAT_ITEM_UNLOCK_NIGHT } from "./sim-shop-acquisition";

const CHALICE_SAVED_BLOOD = 6;
const GRAFT_SCION_PER_NIGHT = 0.75;
const GRAFT_SCION_SAVED_PER_NIGHT = 1;
const BEGGAR_BASELINE_EXTRA_BLOOD = 1;

/**
 * team の ids から level 1 baseline で余剰血液の期待値を推定する。
 * team-build より前に呼ぶため level は不明 — level 1 固定で近似する。
 */
export function estimateTeamEconomyExtraBlood(ids: readonly DataUnitId[], night: number): number {
  let total = 0;
  for (const id of ids) {
    const tier = createUnit(id).tier as Tier;
    const ownedTurns = estimateOwnedTurns(tier, night);
    const ownership = Math.min(1, ownedTurns / Math.max(1, night));

    switch (id) {
      case "beggar":
        total += ownership * BEGGAR_BASELINE_EXTRA_BLOOD;
        break;
      case "chalice":
        total += ownership * CHALICE_SAVED_BLOOD;
        break;
      case "graft_scion":
        total += ownedTurns * GRAFT_SCION_PER_NIGHT * GRAFT_SCION_SAVED_PER_NIGHT;
        break;
      case "tainted_placenta": {
        const lateOwnedTurns = Math.max(
          0,
          ownedTurns - estimateOwnedTurns(tier, STAT_ITEM_UNLOCK_NIGHT - 1),
        );
        total += lateOwnedTurns * atLevel(TAINTED_PLACENTA.bloodGain, 1);
        break;
      }
    }
  }
  return total;
}
