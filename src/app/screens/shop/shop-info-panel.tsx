import { BookOpen } from "lucide-preact";
import type { Selection, EventData } from "../../types";
import { getEquipInfo } from "../../../shared/data/equips";
import { ShopNarrative } from "./shop-narrative";
import { activeEvent } from "../../state/game-store";

interface ShopInfoPanelProps {
  sel: Selection | null;
  currentSanity: number;
}

function EventNarrative({ event }: { event: EventData }) {
  return (
    <div className="animate-fade-in flex flex-col gap-1 text-center">
      <span className="text-[10px] font-bold tracking-widest text-amber-700 uppercase md:text-xs">
        {event.name}
      </span>
      <p className="text-[10px] leading-relaxed text-zinc-400 italic md:text-xs">
        {event.narrative}
      </p>
    </div>
  );
}

function SelectedItemInfo({ sel }: { sel: Selection }) {
  const equipInfo =
    sel.type === "BOARD_UNIT" && sel.item.equip ? getEquipInfo(sel.item.equip) : null;

  return (
    <div className="animate-fade-in relative z-10">
      <div className="mb-1 flex items-center justify-between border-b border-zinc-800/50 pb-1">
        <span className="flex items-center gap-1 text-xs font-bold text-emerald-500 md:text-sm">
          <BookOpen size={14} className="text-zinc-500" /> {sel.item.name}
        </span>
        <span className="rounded bg-emerald-950/30 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-emerald-700 md:text-[10px]">
          {sel.item.skillText}
        </span>
      </div>
      <p className="pl-1 text-[10px] leading-relaxed text-zinc-500 italic md:text-xs">
        {sel.item.lore}
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

export function ShopInfoPanel({ sel, currentSanity }: ShopInfoPanelProps) {
  const event = activeEvent.value;
  const borderClass =
    !sel && currentSanity <= 1 ? "bg-red-950/20 border-red-900/50" : "bg-[#0a0a0a] border-zinc-800";

  return (
    <section
      aria-label="情報パネル"
      className={`mb-3 flex min-h-[85px] shrink-0 flex-col justify-center rounded border p-2 transition-all md:min-h-[100px] md:p-3 ${borderClass}`}
    >
      {sel ? (
        <SelectedItemInfo sel={sel} />
      ) : event ? (
        <EventNarrative event={event} />
      ) : (
        <div aria-live={currentSanity <= 1 ? "assertive" : "polite"}>
          <ShopNarrative currentSanity={currentSanity} />
        </div>
      )}
    </section>
  );
}
