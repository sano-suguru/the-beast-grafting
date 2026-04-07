import { Heart, Swords } from "lucide-preact";
import type { UnitBattleStat } from "./compute-stats";

function UnitStatRow({ stat }: { stat: UnitBattleStat }) {
  const opacity = stat.alive ? "" : "opacity-50";
  return (
    <li className={`flex items-center gap-3 py-1.5 ${opacity}`}>
      <span className="text-parchment-bright min-w-[5rem] truncate text-xs font-bold">
        {stat.name}
      </span>
      <span className="text-tarnished-gold flex items-center gap-1 text-xs">
        <Swords size={12} />
        {stat.damageDealt}
      </span>
      <span className="text-blood-bright flex items-center gap-1 text-xs">
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
      <h3 className="text-parchment-dim mb-1 text-[0.65rem] font-bold tracking-widest uppercase">
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
