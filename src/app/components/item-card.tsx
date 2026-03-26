import { Droplet, Activity } from "lucide-preact";
import { selection, blood } from "../state/game-store";
import { handleCardClick } from "../state/card-actions";
import type { ItemData } from "../types";

interface ItemCardProps {
  item: ItemData | null;
  index: number;
}

function getBorderClass(isSelected: boolean, cantAfford: boolean): string {
  if (isSelected) return "border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)] scale-105 z-10";
  if (cantAfford) return "border-red-900/30";
  return "border-zinc-700";
}

function getCardClass(borderClass: string, cantAfford: boolean): string {
  const hover = cantAfford ? "" : "hover:border-zinc-500";
  return `w-12 md:w-16 shrink-0 aspect-[3/4] bg-zinc-900 border ${borderClass} rounded relative flex flex-col cursor-pointer transition-all ${hover} select-none`;
}

function getContentClass(cantAfford: boolean): string {
  const dim = cantAfford ? "opacity-40 grayscale" : "";
  return `flex flex-col flex-1 p-1 ${dim}`;
}

function getNameClass(isPureBlood: boolean): string {
  const color = isPureBlood ? "text-red-500" : "text-emerald-600/80";
  return `text-[7px] md:text-[9px] text-center font-bold leading-tight pointer-events-none break-words line-clamp-2 ${color}`;
}

function getCostBadgeClass(cantAfford: boolean): string {
  const style = cantAfford ? "opacity-40 grayscale" : "text-amber-400";
  return `absolute -bottom-1 -left-1 bg-zinc-800 text-[8px] px-1 rounded border border-zinc-700 pointer-events-none ${style}`;
}

export function ItemCard({ item, index }: ItemCardProps) {
  if (!item) {
    return (
      <div className="aspect-[3/4] w-12 shrink-0 rounded border border-dashed border-zinc-800 bg-zinc-900/50 md:w-16" />
    );
  }
  const sel = selection.value;
  const isSelected = sel?.type === "SHOP_ITEM" && sel?.index === index;
  const cost = item.cost;
  const cantAfford = blood.value < cost;
  const borderClass = getBorderClass(isSelected, cantAfford);
  const isPureBlood = item.id === "pure_blood";

  return (
    <button
      type="button"
      aria-label={item.name}
      onClick={() => handleCardClick("SHOP_ITEM", index, item)}
      className={getCardClass(borderClass, cantAfford)}
    >
      <div className={getContentClass(cantAfford)}>
        <div className={getNameClass(isPureBlood)}>{item.name}</div>
        <div className="pointer-events-none flex flex-1 items-center justify-center">
          {isPureBlood ? (
            <Droplet size={16} className="text-red-800" />
          ) : (
            <Activity size={16} className="text-emerald-800" />
          )}
        </div>
      </div>
      {cost !== 3 && <div className={getCostBadgeClass(cantAfford)}>{cost}</div>}
    </button>
  );
}
