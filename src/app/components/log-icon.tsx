import { Swords, Crosshair, Sparkles, Skull, Shield, Trophy, Info } from "lucide-preact";
import type { BattleLogEntry } from "../types";

export function LogIcon({ entry }: { entry: BattleLogEntry }) {
  const s = 14;
  if (entry.type === "clash") return <Swords size={s} className="shrink-0 text-zinc-400" />;
  if (entry.type === "damage") return <Crosshair size={s} className="shrink-0 text-red-500" />;
  if (entry.type === "skill") return <Sparkles size={s} className="shrink-0 text-amber-400" />;
  if (entry.type === "death") return <Skull size={s} className="shrink-0 text-red-700" />;
  if (entry.type === "defend") return <Shield size={s} className="shrink-0 text-zinc-400" />;
  if (entry.type === "result" && entry.icon === "trophy")
    return <Trophy size={s} className="shrink-0 text-amber-500" />;
  if (entry.type === "result" && entry.icon === "skull")
    return <Skull size={s} className="shrink-0 text-red-600" />;
  return <Info size={s} className="shrink-0 text-zinc-600" />;
}
