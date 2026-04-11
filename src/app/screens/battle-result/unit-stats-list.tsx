import { Heart, Swords } from "lucide-preact";
import type { UnitBattleStat } from "./compute-stats";

function statRowColors(alive: boolean) {
  return alive
    ? { name: "text-parchment-bright", dmg: "text-tarnished-gold", hp: "text-blood-bright" }
    : { name: "text-disabled-fg", dmg: "text-disabled-fg", hp: "text-disabled-fg" };
}

function UnitStatRow({ stat }: { stat: UnitBattleStat }) {
  const c = statRowColors(stat.alive);
  return (
    <li className="flex items-center gap-3 py-1.5">
      <span className={`min-w-[5rem] truncate text-xs font-bold ${c.name}`}>{stat.name}</span>
      <span className={`flex items-center gap-1 text-xs ${c.dmg}`}>
        <Swords size={12} />
        {stat.damageDealt}
      </span>
      <span className={`flex items-center gap-1 text-xs ${c.hp}`}>
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
      <h3 className="text-parchment-dim text-body-sm mb-1 font-bold tracking-widest uppercase">
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
