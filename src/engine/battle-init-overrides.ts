import type { UnitId } from "../shared/types";
import type { BattleUnit } from "./battle-context";
import {
  atLevel,
  EYE,
  CATHEDRAL,
  CARRION_SENTINEL,
  GORILLA,
  SIN_EATER,
} from "../shared/skill-params";
import { BEELZEBUB } from "../shared/skill-params-death";

const INIT_OVERRIDES = {
  eye: (bu: BattleUnit) => {
    bu.skillUses = atLevel(EYE.uses, bu.level);
  },
  beelzebub: (bu: BattleUnit) => {
    bu.skillUses = atLevel(BEELZEBUB.uses, bu.level);
  },
  cathedral: (bu: BattleUnit) => {
    bu.skillUses = atLevel(CATHEDRAL.uses, bu.level);
  },
  puppeteer: (bu: BattleUnit) => {
    bu.skillUses = atLevel(GORILLA.uses, bu.level);
  },
  carrion_sentinel: (bu: BattleUnit) => {
    bu.skillUses = atLevel(CARRION_SENTINEL.uses, bu.level);
  },
  sin_eater: (bu: BattleUnit) => {
    bu.skillUses = SIN_EATER.maxUses;
  },
  necrotic_finger: (bu: BattleUnit) => {
    if (!bu.equip) bu.equip = "corpse_wax";
  },
} satisfies Partial<Record<UnitId, (bu: BattleUnit) => void>>;

type InitOverrideUnitId = keyof typeof INIT_OVERRIDES;

export function getInitOverride(id: UnitId): ((bu: BattleUnit) => void) | undefined {
  return Object.hasOwn(INIT_OVERRIDES, id) ? INIT_OVERRIDES[id as InitOverrideUnitId] : undefined;
}
