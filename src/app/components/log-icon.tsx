import { Swords, Crosshair, Sparkles, Skull, Shield, Trophy, Info } from "lucide-preact";
import type { BattleLogEntry } from "../types";

export function LogIcon({ entry }: { entry: BattleLogEntry }) {
  const s = 14;
  if (entry.type === "clash") return <Swords size={s} className="text-iron-light shrink-0" />;
  if (entry.type === "damage") return <Crosshair size={s} className="text-blood-bright shrink-0" />;
  if (entry.type === "skill") return <Sparkles size={s} className="text-tarnished-gold shrink-0" />;
  if (entry.type === "death") return <Skull size={s} className="text-blood-deep shrink-0" />;
  if (entry.type === "defend") return <Shield size={s} className="text-iron-light shrink-0" />;
  if (entry.type === "result" && entry.icon === "trophy")
    return <Trophy size={s} className="text-tarnished-gold shrink-0" />;
  if (entry.type === "result" && entry.icon === "skull")
    return <Skull size={s} className="text-blood-bright shrink-0" />;
  return <Info size={s} className="text-iron-light shrink-0" />;
}
