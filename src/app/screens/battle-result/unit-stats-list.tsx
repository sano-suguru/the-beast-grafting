import { Heart, Swords } from "lucide-preact";
import type { UnitBattleStat } from "./compute-stats";

function UnitStatRow({ stat }: { stat: UnitBattleStat }) {
  const opacity = stat.alive ? "" : "opacity-50";
  return (
    <li className={`flex items-center gap-3 py-1.5 ${opacity}`}>
      <span className="min-w-[5rem] truncate text-xs font-bold text-zinc-200">{stat.name}</span>
      <span className="flex items-center gap-1 text-xs text-amber-500">
        <Swords size={12} />
        {stat.damageDealt}
      </span>
      <span className="flex items-center gap-1 text-xs text-rose-500">
        <Heart size={12} />
        {stat.finalHp}/{stat.maxHp}
      </span>
    </li>
  );
}

export function UnitStatsList({ label, units }: { label: string; units: UnitBattleStat[] }) {
  if (units.length === 0) return null;
  return (
    <div className="w-full">
      <h3 className="mb-1 text-[0.65rem] font-bold tracking-widest text-zinc-500 uppercase">
        {label}
      </h3>
      <ul className="space-y-0.5">
        {units.map((u) => (
          <UnitStatRow key={u.uid} stat={u} />
        ))}
      </ul>
    </div>
  );
}
