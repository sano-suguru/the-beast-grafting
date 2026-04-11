import type { ComponentChildren } from "preact";
import { selection, blood } from "../state/game-store";
import { handleCardClick, clearHover, setHover, toSelectionType } from "../state/card-actions";
import { initAudio, playSEFrom } from "../engine/audio";
import { UNIT_COST, expPerLevel, MAX_UNIT_LEVEL, CUMULATIVE_EXP } from "../../shared/constants";
import { effectiveAtk, effectiveHp } from "../../shared/unit-stats";
import { getUnitIcon } from "../data/unit-icons";
import { StatBadge } from "./stat-badge";
import { EquipIcon } from "./equip-icon";
import type { Tier } from "../../shared/data/tiers";
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
  if (isSelected) return "border-tarnished-gold shadow-selected scale-105 z-10";
  if (isFrozen)
    return "border-tarnished-gold-dim/50 ring-1 ring-tarnished-gold-dim shadow-frozen-inset";
  if (isHighlight === "swap")
    return "border-dashed border-tarnished-gold-dim shadow-glow-gold-card";
  if (isHighlight === "passive-graft") return "border-blood-bright/50 animate-graft-resonance";
  if (isHighlight === "graft") return "border-tarnished-gold animate-graft-resonance-active";
  if (isHighlight) return "border-tarnished-gold shadow-glow-gold-xs";
  if (cantAfford) return "border-blood-deep/30";
  return "border-iron";
}

const LEVEL_COLORS: Record<number, string> = { 2: "text-tarnished-gold-dim", 3: "text-hex-dim" };

function getHoverEffect(cantAfford: boolean, isHighlight: HighlightKind | undefined): string {
  if (cantAfford) return "";
  if (isHighlight === "swap") return "hover:shadow-hover-swap hover:scale-[1.02]";
  if (isHighlight) return "hover:shadow-hover-highlight hover:scale-[1.02]";
  return "hover:brightness-110";
}

function getCardClass(
  border: string,
  cantAfford: boolean,
  isHighlight: HighlightKind | undefined,
): string {
  const hover = getHoverEffect(cantAfford, isHighlight);
  return `w-full aspect-[2/3] bg-void-surface border ${border} rounded-sm relative flex flex-col cursor-pointer transition-[color,background-color,border-color,box-shadow,transform] ${hover} select-none`;
}

function getNameClass(isChurch: boolean): string {
  const color = isChurch ? "text-church" : "text-parchment-bright";
  return `text-card-sm md:text-card-md text-center font-bold leading-tight h-6 md:h-8 overflow-hidden mt-0.5 md:mt-1 pointer-events-none break-words line-clamp-2 ${color}`;
}

function ExpBar({ level, exp }: { level: number; exp: number }) {
  if (level >= MAX_UNIT_LEVEL) return null;
  const needed = expPerLevel(level);
  const baseExp = CUMULATIVE_EXP[level as keyof typeof CUMULATIVE_EXP] ?? 0;
  const filled = Math.max(0, Math.min(needed, exp - baseExp));
  const pct = (filled / needed) * 100;
  return (
    <div className="bg-iron mx-1 h-1 rounded-full" aria-label={`経験値${filled}/${needed}`}>
      {pct > 0 && (
        <div className="bg-tarnished-gold h-full rounded-full" style={{ width: `${pct}%` }} />
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
      className={`group bg-void-surface/50 flex aspect-[2/3] w-full cursor-pointer items-center justify-center rounded-sm border border-dashed transition-[color,background-color,border-color,box-shadow,transform] ${isHighlight ? "border-tarnished-gold-dim/50 bg-tarnished-gold-dim/10 hover:border-tarnished-gold hover:bg-tarnished-gold-dim/20 hover:shadow-glow-gold-sm shadow-glow-gold-xs-inset hover:scale-[1.02]" : "border-iron/30"}`}
    >
      <span className="text-iron-light text-card-sm tracking-widest opacity-50 transition-opacity group-hover:opacity-100">
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
  tier: Tier;
  cantAfford: boolean;
}) {
  if (type !== "SHOP_UNIT") return null;
  return (
    <>
      {cost !== UNIT_COST && (
        <div className="border-iron bg-void-surface text-parchment text-card-sm pointer-events-none absolute -top-1 -left-1 flex items-center gap-px rounded border px-1 font-bold">
          {cost}
        </div>
      )}
      <div className="border-iron bg-void-surface text-parchment-dim text-card-sm md:text-card-md pointer-events-none absolute -right-1 -bottom-2.5 rounded border px-1 font-bold">
        T{tier}
      </div>
      {cantAfford && (
        <div className="pointer-events-none absolute inset-0 rounded-md bg-black/50 backdrop-grayscale" />
      )}
    </>
  );
}

function UnitCardContent({ unit }: { unit: UnitInstance }) {
  const Icon = getUnitIcon(unit.id);
  return (
    <div className="flex flex-1 flex-col p-1 md:p-1.5">
      <div className={getNameClass(unit.isChurch)}>{unit.name}</div>
      <div className="pointer-events-none flex flex-1 items-center justify-center">
        <Icon className={`size-4.5 md:size-7 ${LEVEL_COLORS[unit.level] || "text-iron-light"}`} />
      </div>
      <ExpBar level={unit.level} exp={unit.exp} />
      <div className="border-iron/30 bg-void pointer-events-none flex items-center justify-between rounded border-t px-1">
        <StatBadge value={effectiveAtk(unit)} statType="atk" />
        <span className="text-iron-light md:text-card-md text-card-sm">Lv{unit.level}</span>
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
          <div className="border-church-dark pointer-events-none absolute -top-1 -right-1 z-10 rounded-full border bg-black/80 p-0.5">
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
