import { BookOpen, Skull, Swords, Shield } from "lucide-preact";
import { ResourceText } from "../../components/resource-text";
import type { Selection, EventData } from "../../types";
import { getEquipInfo } from "../../../shared/data/equips";
import { effectiveAtk, effectiveHp } from "../../../shared/unit-stats";
import { toLifeTier } from "../../../shared/types";
import { ShopNarrative } from "./shop-narrative";
import { activeEvent } from "../../state/game-store";

interface ShopInfoPanelProps {
  sel: Selection | null;
  hover: Selection | null;
  currentLife: number;
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
      <span className="text-tarnished-gold text-[10px] font-bold tracking-widest uppercase md:text-xs">
        {event.name}
      </span>
      <p className="text-parchment-muted text-[10px] leading-relaxed italic md:text-xs">
        {event.narrative}
      </p>
      {badges.length > 0 && (
        <div className="mt-0.5 flex flex-wrap justify-center gap-1">
          {badges.map((b, i) => (
            <span
              key={i}
              className={`rounded border px-1 py-0.5 text-[9px] font-bold md:text-[10px] ${
                b.positive
                  ? "border-tarnished-gold-dim/50 text-tarnished-gold"
                  : "border-blood-deep/50 text-blood-bright/70"
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
  return buff > 0 ? "text-tarnished-gold" : "text-blood-bright/70";
}

function buffPrefix(buff: number): string {
  return buff > 0 ? "+" : "";
}

function UnitStatDisplay({ sel }: { sel: Selection }) {
  if (sel.type === "SHOP_ITEM") return null;
  return (
    <div className="ml-auto flex items-center gap-2">
      <span className="text-tarnished-gold flex items-center gap-0.5 text-[11px] font-bold md:text-xs">
        <Swords size={12} />
        {effectiveAtk(sel.item)}
        {sel.item.buffAtk !== 0 && (
          <span className={buffColor(sel.item.buffAtk)}>
            {buffPrefix(sel.item.buffAtk)}
            {sel.item.buffAtk}
          </span>
        )}
      </span>
      <span className="text-blood-bright flex items-center gap-0.5 text-[11px] font-bold md:text-xs">
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
      <div className="border-iron/50 mb-1 flex items-center gap-1 border-b pb-1">
        <BookOpen size={14} className="text-parchment-dim shrink-0" />
        <span className="text-tarnished-gold text-xs font-bold md:text-sm">{sel.item.name}</span>
        {"tier" in sel.item && (
          <span className="text-parchment-dim text-[9px] font-bold md:text-[10px]">
            Tier {sel.item.tier}
          </span>
        )}
        <UnitStatDisplay sel={sel} />
      </div>
      <p className="text-tarnished-gold/80 pl-1 font-mono text-[10px] md:text-xs">
        <ResourceText text={sel.item.skillText} />
      </p>
      <p className="text-parchment-muted mt-1 pl-1 text-[10px] leading-relaxed italic md:text-xs">
        "{sel.item.lore}"
      </p>
      {equipInfo && (
        <div className="border-iron/50 mt-1.5 flex items-center gap-2 border-t pt-1.5">
          <span className="border-tarnished-gold-dim/50 text-tarnished-gold-dim rounded border px-1 text-[9px]">
            付与中
          </span>
          <span className="text-tarnished-gold text-[10px] font-bold md:text-xs">
            {equipInfo.name}
          </span>
          <span className="text-parchment-dim text-[9px] md:text-[10px]">- {equipInfo.desc}</span>
        </div>
      )}
    </div>
  );
}

function InfoPanelContent({
  sel,
  hover,
  event,
  currentLife,
}: {
  sel: Selection | null;
  hover: Selection | null;
  event: EventData | null;
  currentLife: number;
}) {
  if (sel) return <SelectedItemInfo sel={sel} />;
  if (hover) return <SelectedItemInfo sel={hover} />;
  if (event) return <EventNarrative event={event} />;
  return (
    <div aria-live={toLifeTier(currentLife) === "low" ? "assertive" : "polite"}>
      <ShopNarrative currentLife={currentLife} />
    </div>
  );
}

function panelBorderClass(sel: Selection | null, currentLife: number): string {
  return !sel && toLifeTier(currentLife) === "low"
    ? "bg-blood-deep/20 border-blood-deep/50"
    : "bg-void border-iron/50";
}

export function ShopInfoPanel({ sel, hover, currentLife }: ShopInfoPanelProps) {
  const event = activeEvent.value;

  return (
    <section
      aria-label="情報パネル"
      className={`relative flex min-h-[120px] shrink-0 flex-col justify-center overflow-hidden rounded border p-2 transition-all md:min-h-[140px] md:p-3 ${panelBorderClass(sel, currentLife)}`}
    >
      {!sel && !event && (
        <Skull size={40} className="pointer-events-none absolute right-2 bottom-2 opacity-[0.03]" />
      )}
      <InfoPanelContent sel={sel} hover={hover} event={event} currentLife={currentLife} />
    </section>
  );
}
