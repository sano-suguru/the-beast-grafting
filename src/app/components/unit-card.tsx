import { Swords, Shield, Dna, Droplet } from "lucide-preact";
import type { ComponentChildren } from "preact";
import { selection, blood } from "../state/game-store";
import { handleCardClick } from "../state/card-actions";
import { UNIT_COST } from "../../shared/constants";
import { StatBadge } from "./stat-badge";
import { EquipIcon } from "./equip-icon";
import type { UnitInstance, Selection, HighlightKind } from "../types";

interface UnitCardProps {
  unit: UnitInstance | null;
  type: Selection["type"] | "BOARD_SLOT";
  index: number;
  isHighlight?: HighlightKind | undefined;
  costOverride?: number | undefined;
  children?: ComponentChildren;
}

function getBorderClass(
  isSelected: boolean,
  isHighlight: HighlightKind | undefined,
  cantAfford: boolean,
): string {
  if (isSelected) return "border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)] scale-105 z-10";
  if (isHighlight === "swap")
    return "border-dashed border-emerald-800 shadow-[0_0_8px_rgba(16,185,129,0.12)]";
  if (isHighlight) return "border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]";
  if (cantAfford) return "border-red-900/30";
  return "border-zinc-700";
}

const DNA_COLORS: Record<number, string> = { 2: "text-emerald-700", 3: "text-purple-700" };

function getCardClass(border: string, cantAfford: boolean): string {
  const hover = cantAfford ? "" : "hover:border-zinc-500";
  return `w-full aspect-[2/3] bg-zinc-900 border ${border} rounded relative flex flex-col cursor-pointer transition-all ${hover} select-none`;
}

function getNameClass(isChurch: boolean): string {
  const color = isChurch ? "text-amber-200" : "text-zinc-300";
  return `text-[8px] md:text-[10px] text-center font-bold leading-tight h-6 md:h-8 overflow-hidden mt-0.5 md:mt-1 pointer-events-none break-words line-clamp-2 ${color}`;
}

function getStatClass(isSelected: boolean): string {
  return isSelected ? "text-emerald-400" : "text-zinc-400";
}

function getLevelBadgeClass(cantAfford: boolean): string {
  const dim = cantAfford ? "opacity-40 grayscale" : "";
  return `absolute -bottom-1 -left-1 bg-zinc-800 text-[8px] md:text-[9px] px-1 rounded border border-zinc-700 pointer-events-none ${dim}`;
}

function getContentClass(cantAfford: boolean): string {
  const dim = cantAfford ? "opacity-40 grayscale" : "";
  return `flex flex-col flex-1 p-1 md:p-1.5 ${dim}`;
}

function EmptySlot({
  type,
  index,
  isHighlight,
}: {
  type: Selection["type"] | "BOARD_SLOT";
  index: number;
  isHighlight?: HighlightKind | undefined;
}) {
  const isSlot = type === "BOARD_SLOT";
  return (
    <button
      type="button"
      aria-label="空きスロット"
      onClick={() => handleCardClick(isSlot ? "BOARD_SLOT" : type, index, null)}
      className={`flex aspect-[2/3] w-full cursor-pointer items-center justify-center rounded border border-dashed bg-zinc-900/50 transition-colors ${isHighlight ? "border-emerald-700/50 bg-emerald-950/20 shadow-[inset_0_0_10px_rgba(16,185,129,0.1)] hover:border-emerald-500" : "border-zinc-800"}`}
    ></button>
  );
}

export function UnitCard({
  unit,
  type,
  index,
  isHighlight,
  costOverride,
  children,
}: UnitCardProps) {
  if (!unit) {
    return (
      <div className="relative max-w-[72px] min-w-[50px] flex-1">
        <EmptySlot type={type} index={index} isHighlight={isHighlight} />
      </div>
    );
  }

  const sel = selection.value;
  const isSlot = type === "BOARD_SLOT";
  const isSelected = sel?.type === type && sel?.index === index;
  const cost = type === "SHOP_UNIT" ? (costOverride ?? UNIT_COST) : UNIT_COST;
  const cantAfford = type === "SHOP_UNIT" && blood.value < cost;
  const border = getBorderClass(isSelected, isHighlight, cantAfford);
  const statClass = getStatClass(isSelected);

  return (
    <div className="relative max-w-[72px] min-w-[50px] flex-1">
      <button
        type="button"
        aria-label={unit.name}
        onClick={() => handleCardClick(isSlot ? "BOARD_SLOT" : type, index, unit)}
        className={getCardClass(border, cantAfford)}
      >
        <div className={getContentClass(cantAfford)}>
          <div className={getNameClass(unit.isChurch)}>{unit.name}</div>
          <div className="pointer-events-none flex flex-1 items-center justify-center">
            <EquipIcon equipId={unit.equip} />
            <Dna size={18} className={DNA_COLORS[unit.level] || "text-zinc-600"} />
          </div>
          <div className="pointer-events-none flex items-center justify-between rounded bg-zinc-950 px-1">
            <StatBadge icon={Swords} value={unit.atk} className={statClass} />
            <StatBadge icon={Shield} value={unit.hp} className={statClass} />
          </div>
        </div>
        {unit.level > 1 && <div className={getLevelBadgeClass(cantAfford)}>Lv{unit.level}</div>}
        {type === "SHOP_UNIT" && cost !== UNIT_COST && (
          <div className="pointer-events-none absolute -top-1 -right-1 flex items-center gap-px rounded border border-zinc-600 bg-zinc-800 px-1 text-[8px] font-bold text-zinc-300">
            {cost}
            <Droplet size={7} className="text-red-800" />
          </div>
        )}
      </button>
      {children}
    </div>
  );
}
