import { Dna } from "lucide-preact";
import type { ComponentChildren } from "preact";
import { selection, blood } from "../state/game-store";
import { handleCardClick, clearHover, setHover, toSelectionType } from "../state/card-actions";
import { initAudio, playSEFrom } from "../engine/audio";
import { UNIT_COST, expPerLevel, MAX_UNIT_LEVEL, CUMULATIVE_EXP } from "../../shared/constants";
import { effectiveAtk, effectiveHp } from "../../shared/unit-stats";
import { StatBadge } from "./stat-badge";
import { EquipIcon } from "./equip-icon";
import type { UnitInstance, UnitSlotType, HighlightKind } from "../types";

interface UnitCardProps {
  unit: UnitInstance | null;
  type: UnitSlotType;
  index: number;
  isHighlight?: HighlightKind | undefined;
  costOverride?: number | undefined;
  isFrozen?: boolean | undefined;
  children?: ComponentChildren;
}

function getBorderClass(
  isSelected: boolean,
  isFrozen: boolean,
  isHighlight: HighlightKind | undefined,
  cantAfford: boolean,
): string {
  if (isSelected) return "border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)] scale-105 z-10";
  if (isFrozen)
    return "border-amber-700/50 ring-1 ring-amber-700 shadow-[inset_0_0_12px_rgba(180,83,9,0.4)]";
  if (isHighlight === "swap")
    return "border-dashed border-emerald-800 shadow-[0_0_8px_rgba(16,185,129,0.12)]";
  if (isHighlight === "passive-graft") return "border-rose-900/50 animate-graft-resonance";
  if (isHighlight === "graft") return "border-emerald-500 animate-graft-resonance-active";
  if (isHighlight) return "border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]";
  if (cantAfford) return "border-red-900/30";
  return "border-zinc-700";
}

const DNA_COLORS: Record<number, string> = { 2: "text-emerald-700", 3: "text-purple-700" };

function getHoverEffect(cantAfford: boolean, isHighlight: HighlightKind | undefined): string {
  if (cantAfford) return "";
  if (isHighlight === "swap")
    return "hover:shadow-[0_0_12px_rgba(16,185,129,0.3)] hover:scale-[1.02]";
  if (isHighlight) return "hover:shadow-[0_0_16px_rgba(16,185,129,0.5)] hover:scale-[1.02]";
  return "hover:brightness-110";
}

function getCardClass(
  border: string,
  cantAfford: boolean,
  isHighlight: HighlightKind | undefined,
): string {
  const hover = getHoverEffect(cantAfford, isHighlight);
  return `w-full aspect-[2/3] bg-zinc-900 border ${border} rounded-md relative flex flex-col cursor-pointer transition-[color,background-color,border-color,box-shadow,transform] ${hover} select-none`;
}

function getNameClass(isChurch: boolean): string {
  const color = isChurch ? "text-amber-200" : "text-zinc-300";
  return `text-[8px] md:text-[10px] text-center font-bold leading-tight h-6 md:h-8 overflow-hidden mt-0.5 md:mt-1 pointer-events-none break-words line-clamp-2 ${color}`;
}

function ExpBar({ level, exp }: { level: number; exp: number }) {
  if (level >= MAX_UNIT_LEVEL) return null;
  const needed = expPerLevel(level);
  const baseExp = CUMULATIVE_EXP[level as keyof typeof CUMULATIVE_EXP] ?? 0;
  const filled = Math.max(0, Math.min(needed, exp - baseExp));
  const pct = (filled / needed) * 100;
  return (
    <div className="mx-1 h-1 rounded-full bg-zinc-800" aria-label={`経験値${filled}/${needed}`}>
      {pct > 0 && (
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      )}
    </div>
  );
}

function EmptySlot({
  type,
  index,
  isHighlight,
}: {
  type: UnitSlotType;
  index: number;
  isHighlight?: HighlightKind | undefined;
}) {
  const isSlot = type === "BOARD_SLOT";
  return (
    <button
      type="button"
      aria-label="空きスロット"
      onClick={() => {
        initAudio();
        playSEFrom(handleCardClick(isSlot ? "BOARD_SLOT" : type, index, null));
      }}
      onMouseEnter={clearHover}
      className={`group flex aspect-[2/3] w-full cursor-pointer items-center justify-center rounded-md border border-dashed bg-zinc-900/50 transition-[color,background-color,border-color,box-shadow,transform] ${isHighlight ? "border-emerald-700/50 bg-emerald-950/20 shadow-[inset_0_0_10px_rgba(16,185,129,0.1)] hover:scale-[1.02] hover:border-emerald-500 hover:bg-emerald-950/30 hover:shadow-[0_0_16px_rgba(16,185,129,0.4)]" : "border-zinc-800"}`}
    >
      <span className="text-[8px] tracking-widest text-zinc-700 opacity-50 transition-opacity group-hover:opacity-100">
        空
      </span>
    </button>
  );
}

function UnitCardBadges({
  type,
  cost,
  tier,
  cantAfford,
}: {
  type: UnitSlotType;
  cost: number;
  tier: number;
  cantAfford: boolean;
}) {
  if (type !== "SHOP_UNIT") return null;
  return (
    <>
      {cost !== UNIT_COST && (
        <div className="pointer-events-none absolute -top-1 -left-1 flex items-center gap-px rounded border border-zinc-600 bg-zinc-800 px-1 text-[8px] font-bold text-zinc-300">
          {cost}
        </div>
      )}
      <div className="pointer-events-none absolute -right-1 -bottom-2.5 rounded border border-zinc-700 bg-zinc-800 px-1 text-[7px] font-bold text-zinc-500 md:text-[8px]">
        T{tier}
      </div>
      {cantAfford && (
        <div className="pointer-events-none absolute inset-0 rounded-md bg-black/50 backdrop-grayscale" />
      )}
    </>
  );
}

function UnitCardContent({ unit }: { unit: UnitInstance }) {
  return (
    <div className="flex flex-1 flex-col p-1 md:p-1.5">
      <div className={getNameClass(unit.isChurch)}>{unit.name}</div>
      <div className="pointer-events-none flex flex-1 items-center justify-center">
        <Dna size={18} className={DNA_COLORS[unit.level] || "text-zinc-600"} />
      </div>
      <ExpBar level={unit.level} exp={unit.exp} />
      <div className="pointer-events-none flex items-center justify-between rounded bg-zinc-950 px-1">
        <StatBadge value={effectiveAtk(unit)} statType="atk" />
        <span className="text-[8px] text-zinc-600 md:text-[9px]">Lv{unit.level}</span>
        <StatBadge value={effectiveHp(unit)} statType="hp" />
      </div>
    </div>
  );
}

type FilledUnitCardProps = Omit<UnitCardProps, "unit"> & { unit: UnitInstance };

function FilledCard({
  unit,
  type,
  index,
  isHighlight,
  costOverride,
  isFrozen,
  children,
}: FilledUnitCardProps) {
  const sel = selection.value;
  const selectionType = toSelectionType(type);
  const isSelected = sel?.type === selectionType && sel?.index === index;
  const cost = type === "SHOP_UNIT" ? (costOverride ?? UNIT_COST) : UNIT_COST;
  const cantAfford = type === "SHOP_UNIT" && blood.value < cost;
  const border = getBorderClass(isSelected, !!isFrozen, isHighlight, cantAfford);

  return (
    <div className="relative max-w-[72px] min-w-[50px] flex-1">
      <button
        type="button"
        aria-label={unit.name}
        onClick={() => {
          initAudio();
          playSEFrom(handleCardClick(type, index, unit));
        }}
        onMouseEnter={() => {
          setHover(selectionType, index, unit);
        }}
        onMouseLeave={clearHover}
        className={getCardClass(border, cantAfford, isHighlight)}
      >
        <UnitCardContent unit={unit} />
        {unit.equip && (
          <div className="pointer-events-none absolute -top-1 -right-1 z-10 rounded-full border border-amber-900 bg-black/80 p-0.5">
            <EquipIcon equipId={unit.equip} />
          </div>
        )}
        <UnitCardBadges type={type} cost={cost} tier={unit.tier} cantAfford={cantAfford} />
      </button>
      {children}
    </div>
  );
}

export function UnitCard(props: UnitCardProps) {
  if (!props.unit) {
    return (
      <div className="relative max-w-[72px] min-w-[50px] flex-1">
        <EmptySlot type={props.type} index={props.index} isHighlight={props.isHighlight} />
      </div>
    );
  }
  return <FilledCard {...props} unit={props.unit} />;
}
