export const ENEMY_FACTIONS = ["教団", "同業者"] as const;

export type EnemyFaction = (typeof ENEMY_FACTIONS)[number];

const factionSet: ReadonlySet<string> = new Set(ENEMY_FACTIONS);

export function isEnemyFaction(value: unknown): value is EnemyFaction {
  return typeof value === "string" && factionSet.has(value);
}
