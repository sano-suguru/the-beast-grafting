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
  iron: { Icon: ShieldAlert, className: "text-zinc-500" },
  corpse_wax: { Icon: Hexagon, className: "text-blue-300/80" },
  berserk: { Icon: Flame, className: "text-red-700" },
  infection: { Icon: Biohazard, className: "text-emerald-500" },
  maggot_nest: { Icon: Bug, className: "text-amber-600" },
  numbness: { Icon: Minus, className: "text-zinc-400" },
  acid: { Icon: FlaskConical, className: "text-lime-500" },
  death_curse: { Icon: RotateCcw, className: "text-purple-500" },
};

export function EquipIcon({ equipId }: { equipId: EquipType | null }) {
  if (!equipId) return null;
  const { Icon, className } = EQUIP_ICONS[equipId];
  return <Icon size={14} className={className} aria-hidden="true" />;
}
