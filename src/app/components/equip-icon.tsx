import {
  ShieldAlert,
  Hexagon,
  Flame,
  Biohazard,
  Bug,
  Minus,
  FlaskConical,
  RotateCcw,
} from "lucide-preact";
import type { EquipType } from "../types";

const EQUIP_ICONS: Record<EquipType, { Icon: typeof ShieldAlert; className: string }> = {
  iron: { Icon: ShieldAlert, className: "text-iron-light" },
  corpse_wax: { Icon: Hexagon, className: "text-corpse-wax/80" },
  berserk: { Icon: Flame, className: "text-blood-dim" },
  infection: { Icon: Biohazard, className: "text-rot-bright" },
  maggot_nest: { Icon: Bug, className: "text-church-dim" },
  numbness: { Icon: Minus, className: "text-iron-light" },
  acid: { Icon: FlaskConical, className: "text-rot-acid" },
  death_curse: { Icon: RotateCcw, className: "text-hex-dim" },
};

export function EquipIcon({ equipId }: { equipId: EquipType | null }) {
  if (!equipId) return null;
  const { Icon, className } = EQUIP_ICONS[equipId];
  return <Icon size={14} className={className} aria-hidden="true" />;
}
