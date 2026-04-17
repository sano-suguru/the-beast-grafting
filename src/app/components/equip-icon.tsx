import {
  ShieldAlert,
  Hexagon,
  Flame,
  Biohazard,
  Bug,
  Minus,
  FlaskConical,
  RotateCcw,
  Star,
} from "lucide-preact";
import type { EquipType } from "../types";

const EQUIP_ICONS: Record<EquipType, { Icon: typeof ShieldAlert; className: string }> = {
  iron_plate: { Icon: ShieldAlert, className: "text-iron-light" },
  corpse_wax: { Icon: Hexagon, className: "text-corpse-wax" },
  bile: { Icon: Flame, className: "text-blood-dim" },
  infection: { Icon: Biohazard, className: "text-rot-bright" },
  maggot: { Icon: Bug, className: "text-church-dim" },
  numbness: { Icon: Minus, className: "text-iron-light" },
  acid_blood: { Icon: FlaskConical, className: "text-rot-acid" },
  death_curse: { Icon: RotateCcw, className: "text-hex-dim" },
  star_frenzy: { Icon: Star, className: "text-tarnished-gold" },
};

export function EquipIcon({ equipId }: { equipId: EquipType | null }) {
  if (!equipId) return null;
  const { Icon, className } = EQUIP_ICONS[equipId];
  return <Icon size={14} className={className} aria-hidden="true" />;
}
