import type { UnitInstance, EnemyTeam } from "../../shared/types";

/** Knuth multiplicative hash でベースシードとインデックスを混合する */
export function deriveSeed(baseSeed: number, index: number): number {
  const raw = Math.imul(baseSeed ^ index, 2654435761) >>> 0;
  return raw || 1;
}

export function makeSimEnemy(units: UnitInstance[]): EnemyTeam {
  return { teamName: "[SIM]", teamType: "同業者", units, night: null, life: null, trophy: null };
}
