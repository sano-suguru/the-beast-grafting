import { BookOpen, Skull, Swords, Shield } from "lucide-preact";
import { ResourceText } from "../../components/resource-text";
import type { Selection, EventData } from "../../types";
import { getEquipInfo } from "../../../shared/data/equips";
import { effectiveAtk, effectiveHp } from "../../../shared/unit-stats";
import { ShopNarrative } from "./shop-narrative";
import { activeEvent } from "../../state/game-store";

interface ShopInfoPanelProps {
  sel: Selection | null;
  currentSanity: number;
}

interface EffectBadge {
  label: string;
  positive: boolean;
}

function collectBloodBadges(event: EventData, badges: EffectBadge[]) {
  if (event.bloodBonus > 0) badges.push({ label: `{blood}+${event.bloodBonus}`, positive: true });
  if (event.bloodBonus < 0) badges.push({ label: `{blood}${event.bloodBonus}`, positive: false });
  if (event.shopUnitBuff) {
    badges.push({
      label: `素体+${event.shopUnitBuff.atk}/+${event.shopUnitBuff.hp}`,
      positive: true,
    });
  }
}

function collectShopBadges(event: EventData, badges: EffectBadge[]) {
  if (event.shopSizeModifier < 0)
    badges.push({ label: `入荷${event.shopSizeModifier}`, positive: false });
  if (event.shopSizeModifier > 0)
    badges.push({ label: `入荷+${event.shopSizeModifier}`, positive: true });
  if (event.freeRoll) badges.push({ label: "無料ロール", positive: true });
  if (event.lockRoll) badges.push({ label: "ロール不可", positive: false });
  if (event.unitOffers.length > 0) badges.push({ label: "感染素体混入", positive: false });
}

function collectOfferBadges(event: EventData, badges: EffectBadge[]) {
  const unitOfferCounts = new Map<string, { count: number; positive: boolean }>();
  for (const offer of event.unitOffers) {
    const label = offer.cost === 0 ? "無料素体" : `特殊素体 ${offer.cost}血`;
    const existing = unitOfferCounts.get(label);
    if (existing) existing.count++;
    else unitOfferCounts.set(label, { count: 1, positive: offer.cost === 0 });
  }
  for (const [label, { count, positive }] of unitOfferCounts) {
    badges.push({ label: count > 1 ? `${label} ×${count}` : label, positive });
  }
  for (const offer of event.itemOffers) {
    badges.push({
      label: offer.cost === 0 ? "無料薬品" : `薬品 ${offer.cost}血`,
      positive: offer.cost === 0,
    });
  }
}

function getEventBadges(event: EventData): EffectBadge[] {
  const badges: EffectBadge[] = [];
  collectBloodBadges(event, badges);
  collectShopBadges(event, badges);
  collectOfferBadges(event, badges);
  return badges;
}

function EventNarrative({ event }: { event: EventData }) {
  const badges = getEventBadges(event);

  return (
    <div className="animate-fade-in flex flex-col gap-1 text-center">
      <span className="text-[10px] font-bold tracking-widest text-amber-700 uppercase md:text-xs">
        {event.name}
      </span>
      <p className="text-[10px] leading-relaxed text-zinc-400 italic md:text-xs">
        {event.narrative}
      </p>
      {badges.length > 0 && (
        <div className="mt-0.5 flex flex-wrap justify-center gap-1">
          {badges.map((b, i) => (
            <span
              key={i}
              className={`rounded border px-1 py-0.5 text-[9px] font-bold md:text-[10px] ${
                b.positive
                  ? "border-emerald-900/50 text-emerald-600/80"
                  : "border-red-900/50 text-red-500/70"
              }`}
            >
              <ResourceText text={b.label} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function buffColor(buff: number): string {
  return buff > 0 ? "text-emerald-500" : "text-red-400";
}

function buffPrefix(buff: number): string {
  return buff > 0 ? "+" : "";
}

function UnitStatDisplay({ sel }: { sel: Selection }) {
  if (sel.type === "SHOP_ITEM") return null;
  return (
    <div className="ml-auto flex items-center gap-2">
      <span className="flex items-center gap-0.5 text-[11px] font-bold text-amber-500 md:text-xs">
        <Swords size={12} />
        {effectiveAtk(sel.item)}
        {sel.item.buffAtk !== 0 && (
          <span className={buffColor(sel.item.buffAtk)}>
            {buffPrefix(sel.item.buffAtk)}
            {sel.item.buffAtk}
          </span>
        )}
      </span>
      <span className="flex items-center gap-0.5 text-[11px] font-bold text-rose-500 md:text-xs">
        <Shield size={12} />
        {effectiveHp(sel.item)}
        {sel.item.buffHp !== 0 && (
          <span className={buffColor(sel.item.buffHp)}>
            {buffPrefix(sel.item.buffHp)}
            {sel.item.buffHp}
          </span>
        )}
      </span>
    </div>
  );
}

function SelectedItemInfo({ sel }: { sel: Selection }) {
  const equipInfo =
    sel.type !== "SHOP_ITEM" && sel.item.equip ? getEquipInfo(sel.item.equip) : null;

  return (
    <div className="animate-fade-in relative z-10">
      <Skull size={48} className="pointer-events-none absolute -right-1 -bottom-1 opacity-5" />
      <div className="mb-1 flex items-center gap-1 border-b border-zinc-800/50 pb-1">
        <BookOpen size={14} className="shrink-0 text-zinc-500" />
        <span className="text-xs font-bold text-emerald-500 md:text-sm">{sel.item.name}</span>
        {"tier" in sel.item && (
          <span className="text-[9px] font-bold text-zinc-500 md:text-[10px]">
            Tier {sel.item.tier}
          </span>
        )}
        <UnitStatDisplay sel={sel} />
      </div>
      <p className="pl-1 font-mono text-[10px] text-amber-500/80 md:text-xs">
        <ResourceText text={sel.item.skillText} />
      </p>
      <p className="mt-1 pl-1 text-[10px] leading-relaxed text-zinc-500 italic md:text-xs">
        "{sel.item.lore}"
      </p>
      {equipInfo && (
        <div className="mt-1.5 flex items-center gap-2 border-t border-zinc-800/50 pt-1.5">
          <span className="rounded border border-amber-900/50 px-1 text-[9px] text-amber-700/80">
            付与中
          </span>
          <span className="text-[10px] font-bold text-amber-600 md:text-xs">{equipInfo.name}</span>
          <span className="text-[9px] text-zinc-500 md:text-[10px]">- {equipInfo.desc}</span>
        </div>
      )}
    </div>
  );
}

function InfoPanelContent({
  sel,
  event,
  currentSanity,
}: {
  sel: Selection | null;
  event: EventData | null;
  currentSanity: number;
}) {
  if (sel) return <SelectedItemInfo sel={sel} />;
  if (event) return <EventNarrative event={event} />;
  return (
    <div aria-live={currentSanity <= 1 ? "assertive" : "polite"}>
      <ShopNarrative currentSanity={currentSanity} />
    </div>
  );
}

function panelBorderClass(sel: Selection | null, currentSanity: number): string {
  return !sel && currentSanity <= 1
    ? "bg-red-950/20 border-red-900/50"
    : "bg-[#0a0a0a] border-zinc-800";
}

export function ShopInfoPanel({ sel, currentSanity }: ShopInfoPanelProps) {
  const event = activeEvent.value;

  return (
    <section
      aria-label="情報パネル"
      className={`relative mb-3 flex min-h-[85px] shrink-0 flex-col justify-center overflow-hidden rounded border p-2 transition-all md:min-h-[100px] md:p-3 ${panelBorderClass(sel, currentSanity)}`}
    >
      {!sel && !event && (
        <Skull size={40} className="pointer-events-none absolute right-2 bottom-2 opacity-[0.03]" />
      )}
      <InfoPanelContent sel={sel} event={event} currentSanity={currentSanity} />
    </section>
  );
}
