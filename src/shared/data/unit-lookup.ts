import type { UnitData, DataUnitId, RegularUnitId, ChurchUnitId } from "../types";
import { UNITS } from "./units";
import { CHURCH_UNITS } from "./church-units";

export function isKnownUnitId(id: string): id is DataUnitId {
  return Object.hasOwn(UNITS, id) || Object.hasOwn(CHURCH_UNITS, id);
}

export function lookupUnitData(id: DataUnitId): UnitData | undefined {
  if (Object.hasOwn(UNITS, id)) return UNITS[id as RegularUnitId];
  if (Object.hasOwn(CHURCH_UNITS, id)) return CHURCH_UNITS[id as ChurchUnitId];
  return undefined;
}

export function isChurchUnit(id: DataUnitId): boolean {
  return Object.hasOwn(CHURCH_UNITS, id);
}
