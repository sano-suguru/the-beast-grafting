import type { JSX } from "preact";
import { useEffect } from "preact/hooks";
import { BookOpen, Skull, Bookmark, Swords, Shield } from "lucide-preact";
import { ResourceText } from "../components/resource-text";
import { UNITS } from "../../shared/data/units";
import { CHURCH_UNITS } from "../../shared/data/church-units";
import { phase } from "../state/game-store";
import { loreDb, loadLore } from "../state/lore";
import { initAudio, playSE } from "../engine/audio";
import { StatBadge } from "../components/stat-badge";
import type { UnitData, LoreEntry } from "../types";

function ChurchUnseenCard({ id }: { id: string }) {
  return (
    <article
      key={id}
      aria-label="未記録の教団兵"
      className="flex gap-3 border border-amber-900/30 bg-amber-950/10 p-3 opacity-40 grayscale"
    >
      <div className="flex aspect-[2/3] w-12 shrink-0 items-center justify-center rounded border border-amber-900/30 bg-zinc-950 md:w-16">
        <Shield size={20} className="text-amber-900/50" />
      </div>
      <div className="flex flex-1 flex-col justify-center">
        <div className="mb-1 text-sm font-bold text-amber-800/60">未記録の教団兵</div>
        <div className="text-[10px] text-amber-900/60">教団との戦闘で遭遇すると記録される。</div>
      </div>
    </article>
  );
}

function ChurchLoreUnitCard({ unit }: { unit: UnitData }) {
  return (
    <article
      aria-label={unit.name}
      className="relative flex gap-3 border border-amber-900/40 bg-amber-950/10 p-3"
    >
      <div className="relative flex aspect-[2/3] w-14 shrink-0 flex-col rounded border border-amber-900/40 bg-zinc-950 p-1 md:w-16">
        <div className="mt-0.5 line-clamp-2 h-6 overflow-hidden text-center text-[8px] leading-tight font-bold break-words text-amber-200 md:h-8 md:text-[9px]">
          {unit.name}
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Shield size={16} className="text-amber-700/50" />
        </div>
        <div className="flex items-center justify-between rounded bg-black px-1">
          <StatBadge icon={Swords} value={unit.baseAtk} className="text-amber-600/70" />
          <StatBadge icon={Shield} value={unit.baseHp} className="text-amber-600/70" />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-1.5 text-sm font-bold text-amber-200">
          {unit.name} <span className="ml-1 text-[10px] text-amber-600/50">Tier {unit.tier}</span>
        </div>
        <div className="mb-2 text-[9px] font-bold text-amber-600/80 md:text-[10px]">
          <ResourceText text={unit.skillText} />
        </div>
        <div className="mb-2 text-[10px] leading-relaxed text-amber-300/60 md:text-xs">
          {unit.lore}
        </div>
      </div>
    </article>
  );
}

function UnseenCard({ id }: { id: string }) {
  return (
    <article
      key={id}
      aria-label="未発見の素体"
      className="flex gap-3 border border-zinc-800/50 bg-zinc-900/30 p-3 opacity-40 grayscale"
    >
      <div className="flex aspect-[2/3] w-12 shrink-0 items-center justify-center rounded border border-zinc-800 bg-zinc-950 md:w-16">
        <Skull size={20} className="text-zinc-800" />
      </div>
      <div className="flex flex-1 flex-col justify-center">
        <div className="mb-1 text-sm font-bold text-zinc-600">未発見の素体</div>
        <div className="text-[10px] text-zinc-700">
          闇市場で発見するか、
          <br />
          解剖台に並べることで記録される。
        </div>
      </div>
    </article>
  );
}

function LoreUnitCard({ unit, entry }: { unit: UnitData; entry: LoreEntry }) {
  const isMastered = entry.mastered;
  return (
    <article
      aria-label={unit.name}
      className={`relative flex gap-3 border p-3 transition-all ${isMastered ? "border-red-900/50 bg-red-950/10 shadow-[inset_0_0_20px_rgba(153,27,27,0.05)]" : "border-zinc-800 bg-zinc-900/50"}`}
    >
      {isMastered && (
        <div
          className="absolute -top-1 -right-1 z-10 text-red-600 drop-shadow-[0_0_5px_rgba(220,38,38,0.5)]"
          title="血印 (Lv3クリア)"
        >
          <Bookmark size={24} fill="currentColor" />
        </div>
      )}
      <div className="relative flex aspect-[2/3] w-14 shrink-0 flex-col rounded border border-zinc-700 bg-zinc-950 p-1 md:w-16">
        <div className="mt-0.5 line-clamp-2 h-6 overflow-hidden text-center text-[8px] leading-tight font-bold break-words text-zinc-300 md:h-8 md:text-[9px]">
          {unit.name}
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Skull size={16} className="text-zinc-600" />
        </div>
        <div className="flex items-center justify-between rounded bg-black px-1">
          <StatBadge icon={Swords} value={unit.baseAtk} className="text-zinc-500" />
          <StatBadge icon={Shield} value={unit.baseHp} className="text-zinc-500" />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-1.5 text-sm font-bold text-zinc-200">
          {unit.name} <span className="ml-1 text-[10px] text-zinc-500">Tier {unit.tier}</span>
        </div>
        <div className="mb-2 text-[9px] font-bold text-emerald-600/80 md:text-[10px]">
          <ResourceText text={unit.skillText} />
        </div>
        <div className="mb-2 text-[10px] leading-relaxed text-zinc-400 md:text-xs">{unit.lore}</div>
        {isMastered ? (
          <div className="animate-fade-in mt-auto border-t border-red-900/30 pt-2 text-[10px] leading-relaxed font-bold text-red-400/90 md:text-xs">
            {unit.secretLore ?? "???"}
          </div>
        ) : (
          <div className="mt-auto border-t border-zinc-800 pt-2 text-[9px] text-zinc-600 italic">
            ※この素体をLv3にして10勝を達成すると、隠された記述が解放される。
          </div>
        )}
      </div>
    </article>
  );
}

function LoreGrid({
  units,
  db,
  renderUnseen,
  renderSeen,
}: {
  units: UnitData[];
  db: Record<string, LoreEntry>;
  renderUnseen: (id: string) => JSX.Element;
  renderSeen: (unit: UnitData, entry: LoreEntry) => JSX.Element;
}) {
  return (
    <ul role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {units.map((unit) => {
        const entry = db[unit.id];
        return <li key={unit.id}>{entry ? renderSeen(unit, entry) : renderUnseen(unit.id)}</li>;
      })}
    </ul>
  );
}

function UnitLoreList({ units, db }: { units: UnitData[]; db: Record<string, LoreEntry> }) {
  return (
    <LoreGrid
      units={units}
      db={db}
      renderUnseen={(id) => <UnseenCard id={id} />}
      renderSeen={(unit, entry) => <LoreUnitCard unit={unit} entry={entry} />}
    />
  );
}

function ChurchLoreList({ units, db }: { units: UnitData[]; db: Record<string, LoreEntry> }) {
  return (
    <div className="mt-8 border-t border-amber-900/30 pt-6">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold tracking-wider text-amber-700/80">
        <Shield size={16} /> 教団兵の記録
      </h2>
      <p className="mb-4 text-center text-[10px] text-amber-800/60 md:text-xs">
        戦場で遭遇した教団の兵士たち。敵を知ることは、生き延びる術である。
      </p>
      <LoreGrid
        units={units}
        db={db}
        renderUnseen={(id) => <ChurchUnseenCard id={id} />}
        renderSeen={(unit) => <ChurchLoreUnitCard unit={unit} />}
      />
    </div>
  );
}

export function LoreScreen() {
  useEffect(() => {
    void loadLore();
  }, []);
  const sortedUnits = Object.values(UNITS)
    .filter((u) => u.tier > 0)
    .sort((a, b) => a.tier - b.tier);
  const churchUnits = Object.values(CHURCH_UNITS).sort((a, b) => a.tier - b.tier);
  const db = loreDb.value;
  const handleClose = () => {
    initAudio();
    playSE("select");
    phase.value = "TITLE";
  };

  return (
    <main className="relative mx-auto flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden border-x border-zinc-900 bg-zinc-950 font-serif text-zinc-300">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 p-3 md:p-4">
        <h1 className="flex items-center gap-2 text-lg font-bold tracking-wider text-zinc-100 md:text-xl">
          <BookOpen className="text-red-800" /> 大解剖録
        </h1>
        <button
          onClick={handleClose}
          className="cursor-pointer rounded border border-zinc-700 px-4 py-1.5 text-xs text-zinc-400 transition-all hover:bg-zinc-800 md:text-sm"
        >
          閉じる
        </button>
      </header>
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <p className="mb-6 text-center text-xs leading-relaxed text-zinc-500 md:text-sm">
          歴代の接合術師たちが書き連ねた狂気の図鑑。
          <br />
          究極の形(Lv3)で狂宴を生き延びた時、真の恐ろしさが記述される。
        </p>
        <UnitLoreList units={sortedUnits} db={db} />
        <ChurchLoreList units={churchUnits} db={db} />
      </div>
    </main>
  );
}
