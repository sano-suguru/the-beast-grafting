export const EQUIP_TYPES = [
  "iron_plate",
  "bile",
  "corpse_wax",
  "infection",
  "maggot",
  "numbness",
  "acid_blood",
  "death_curse",
] as const;

export type EquipType = (typeof EQUIP_TYPES)[number];

const equipSet: ReadonlySet<string> = new Set(EQUIP_TYPES);

export function isEquipType(value: unknown): value is EquipType {
  return typeof value === "string" && equipSet.has(value);
}
