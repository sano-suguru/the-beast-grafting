import { Droplet, Activity } from "lucide-preact";
import { selection, blood } from "../state/game-store";
import { handleCardClick, clearHover, setHover } from "../state/card-actions";
import { initAudio, playSEFrom } from "../engine/audio";
import type { ItemData } from "../types";

interface ItemCardProps {
  item: ItemData | null;
  index: number;
  isFrozen?: boolean | undefined;
}

type FilledItemCardProps = Omit<ItemCardProps, "item"> & { item: ItemData };

function getBorderClass(isSelected: boolean, isFrozen: boolean, cantAfford: boolean): string {
  if (isSelected) return "border-tarnished-gold shadow-selected scale-105 z-10";
  if (isFrozen)
    return "border-tarnished-gold-dim/50 ring-1 ring-tarnished-gold-dim/50 shadow-frozen-inset-sm";
  if (cantAfford) return "border-blood-deep/30";
  return "border-iron";
}

function getCardClass(border: string, cantAfford: boolean, isEquip: boolean): string {
  const hover = cantAfford ? "" : "hover:brightness-110";
  const bg = isEquip ? "bg-tarnished-gold-deep border-tarnished-gold-dim/40" : "bg-void-surface";
  return `w-12 md:w-16 shrink-0 aspect-[3/4] ${bg} border ${border} rounded-sm relative flex flex-col cursor-pointer transition-[border-color,box-shadow,transform,filter] ${hover} select-none`;
}

function getCostBadgeClass(cantAfford: boolean): string {
  const style = cantAfford ? "opacity-40 grayscale" : "text-tarnished-gold";
  return `absolute -bottom-1 -left-1 bg-void-surface text-[8px] px-1 rounded border border-iron pointer-events-none ${style}`;
}

function getItemNameColor(isPureBlood: boolean): string {
  return isPureBlood ? "text-blood-bright" : "text-tarnished-gold/80";
}

function getItemIconColor(isEquip: boolean): string {
  return isEquip ? "text-tarnished-gold-dim" : "text-iron-light";
}

function FilledItemCard({ item, index, isFrozen }: FilledItemCardProps) {
  const sel = selection.value;
  const isSelected = sel?.type === "SHOP_ITEM" && sel?.index === index;
  const cantAfford = blood.value < item.cost;
  const isEquip = item.equip !== null;
  const borderClass = getBorderClass(isSelected, !!isFrozen, cantAfford);
  const isPureBlood = item.id === "pure_blood";

  return (
    <button
      type="button"
      aria-label={item.name}
      onClick={() => {
        initAudio();
        playSEFrom(handleCardClick("SHOP_ITEM", index, item));
      }}
      onMouseEnter={() => {
        setHover("SHOP_ITEM", index, item);
      }}
      onMouseLeave={clearHover}
      className={getCardClass(borderClass, cantAfford, isEquip)}
    >
      <ItemCardBody item={item} isEquip={isEquip} isPureBlood={isPureBlood} />
      {item.cost !== 3 && <div className={getCostBadgeClass(cantAfford)}>{item.cost}</div>}
      {cantAfford && (
        <div className="pointer-events-none absolute inset-0 rounded-md bg-black/50 backdrop-grayscale" />
      )}
    </button>
  );
}

function ItemCardBody({
  item,
  isEquip,
  isPureBlood,
}: {
  item: ItemData;
  isEquip: boolean;
  isPureBlood: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col p-1">
      <div
        className={`pointer-events-none line-clamp-2 text-center text-[7px] leading-tight font-bold break-words md:text-[9px] ${getItemNameColor(isPureBlood)}`}
      >
        {item.name}
      </div>
      <div className="pointer-events-none flex flex-1 flex-col items-center justify-center gap-0.5">
        <span className="text-parchment-dim text-[6px] tracking-wider">
          {isEquip ? "装備" : "消費"}
        </span>
        {isPureBlood ? (
          <Droplet size={16} className="text-blood-dim" />
        ) : (
          <Activity size={16} className={getItemIconColor(isEquip)} />
        )}
      </div>
    </div>
  );
}

export function ItemCard({ item, index, isFrozen }: ItemCardProps) {
  if (!item) {
    return (
      <div className="border-iron/30 bg-void-surface/50 aspect-[3/4] w-12 shrink-0 rounded-sm border border-dashed md:w-16" />
    );
  }
  return <FilledItemCard item={item} index={index} isFrozen={isFrozen} />;
}
