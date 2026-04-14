import type { UnitId } from "../shared/types";
import type { BattleUnit } from "./battle-context";
import {
  atLevel,
  CHOLERA,
  EYE,
  CATHEDRAL,
  SIN_EATER,
  PLAGUE_BELL,
  AMNIOTIC_ARMOR,
  MACHINE,
} from "../shared/skill-params";

const INIT_OVERRIDES = {
  cholera: (bu: BattleUnit) => {
    bu.skillUses = atLevel(CHOLERA.uses, bu.level);
  },
  eye: (bu: BattleUnit) => {
    bu.skillUses = atLevel(EYE.uses, bu.level);
  },
  cathedral: (bu: BattleUnit) => {
    bu.skillUses = atLevel(CATHEDRAL.uses, bu.level);
  },
  sin_eater: (bu: BattleUnit) => {
    bu.skillUses = atLevel(SIN_EATER.uses, bu.level);
  },
  plague_bell: (bu: BattleUnit) => {
    bu.skillUses = atLevel(PLAGUE_BELL.uses, bu.level);
  },
  amniotic_armor: (bu: BattleUnit) => {
    bu.skillUses = atLevel(AMNIOTIC_ARMOR.uses, bu.level);
  },
  machine: (bu: BattleUnit) => {
    bu.skillUses = atLevel(MACHINE.uses, bu.level);
  },
} satisfies Partial<Record<UnitId, (bu: BattleUnit) => void>>;

type InitOverrideUnitId = keyof typeof INIT_OVERRIDES;

export function getInitOverride(id: UnitId): ((bu: BattleUnit) => void) | undefined {
  return Object.hasOwn(INIT_OVERRIDES, id) ? INIT_OVERRIDES[id as InitOverrideUnitId] : undefined;
}
