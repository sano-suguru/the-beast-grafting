import type { RegularUnitId, RawUnitData } from "../types";
import { UNITS_TIER12 } from "./units-tier12";
import { UNITS_TIER34 } from "./units-tier34";
import { UNITS_TIER56 } from "./units-tier56";
import { resolveSkillTexts } from "../skill-text";

export const UNITS = resolveSkillTexts({
  ...UNITS_TIER12,
  ...UNITS_TIER34,
  ...UNITS_TIER56,
} satisfies Record<RegularUnitId, RawUnitData>);
