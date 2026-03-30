export const EQUIP_TYPES = [
  "iron",
  "berserk",
  "corpse_wax",
  "infection",
  "maggot_nest",
  "numbness",
  "acid",
  "death_curse",
] as const;

export type EquipType = (typeof EQUIP_TYPES)[number];

const equipSet: ReadonlySet<string> = new Set(EQUIP_TYPES);

export function isEquipType(value: unknown): value is EquipType {
  return typeof value === "string" && equipSet.has(value);
}
