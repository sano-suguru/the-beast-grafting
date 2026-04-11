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
      className="border-church-dark/30 bg-church-dark/10 flex gap-3 border p-3 opacity-60 grayscale"
    >
      <div className="bg-void border-church-dark/30 flex aspect-[2/3] w-12 shrink-0 items-center justify-center rounded border md:w-16">
        <Shield size={20} className="text-church-muted" />
      </div>
      <div className="flex flex-1 flex-col justify-center">
        <div className="text-church-muted mb-1 text-sm font-bold">未記録の教団兵</div>
        <div className="text-church-muted text-body-xs">教団との戦闘で遭遇すると記録される。</div>
      </div>
    </article>
  );
}

function ChurchLoreUnitCard({ unit }: { unit: UnitData }) {
  return (
    <article
      aria-label={unit.name}
      className="border-church-dark/40 bg-church-dark/10 relative flex gap-3 border p-3"
    >
      <div className="bg-void border-church-dark/40 relative flex aspect-[2/3] w-14 shrink-0 flex-col rounded border p-1 md:w-16">
        <div className="text-church md:text-card-md text-card-sm mt-0.5 line-clamp-2 h-6 overflow-hidden text-center leading-tight font-bold break-words md:h-8">
          {unit.name}
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Shield size={16} className="text-church-muted" />
        </div>
        <div className="flex items-center justify-between rounded bg-black px-1">
          <StatBadge icon={Swords} value={unit.baseAtk} className="text-church-muted" />
          <StatBadge icon={Shield} value={unit.baseHp} className="text-church-muted" />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="text-church mb-1.5 text-sm font-bold">
          {unit.name} <span className="text-church-muted text-body-xs ml-1">Tier {unit.tier}</span>
        </div>
        <div className="text-church-muted md:text-body-xs text-card-md mb-2 font-mono font-bold">
          <ResourceText text={unit.skillText} />
        </div>
        <div className="text-church-lore text-body-xs mb-2 font-serif leading-relaxed md:text-xs">
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
      className="border-iron/50 bg-void-surface/30 flex gap-3 border p-3 opacity-60 grayscale"
    >
      <div className="border-iron bg-void flex aspect-[2/3] w-12 shrink-0 items-center justify-center rounded border md:w-16">
        <Skull size={20} className="text-iron" />
      </div>
      <div className="flex flex-1 flex-col justify-center">
        <div className="text-iron-light mb-1 text-sm font-bold">未発見の素体</div>
        <div className="text-iron-light text-body-xs">
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
      className={`relative flex gap-3 border p-3 transition-all ${isMastered ? "border-tarnished-gold/30 bg-tarnished-gold-deep shadow-glow-gold-inset-lg" : "border-iron bg-void-surface/50"}`}
    >
      {isMastered && (
        <div
          className="text-blood-bright drop-shadow-blood-crown absolute -top-1 -right-1 z-10"
          title="傑作 — Lv3で10勝を達成"
        >
          <Bookmark size={24} fill="currentColor" />
        </div>
      )}
      <div className="border-iron bg-void relative flex aspect-[2/3] w-14 shrink-0 flex-col rounded border p-1 md:w-16">
        <div className="text-parchment-bright md:text-card-md text-card-sm mt-0.5 line-clamp-2 h-6 overflow-hidden text-center leading-tight font-bold break-words md:h-8">
          {unit.name}
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Skull size={16} className="text-iron-light" />
        </div>
        <div className="bg-void flex items-center justify-between rounded px-1">
          <StatBadge icon={Swords} value={unit.baseAtk} className="text-parchment-dim" />
          <StatBadge icon={Shield} value={unit.baseHp} className="text-parchment-dim" />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="text-parchment-bright mb-1.5 text-sm font-bold">
          {unit.name} <span className="text-parchment-dim text-body-xs ml-1">Tier {unit.tier}</span>
        </div>
        <div className="text-gold-muted md:text-body-xs text-card-md mb-2 font-mono font-bold">
          <ResourceText text={unit.skillText} />
        </div>
        <div className="text-parchment-muted text-body-xs mb-2 font-serif leading-relaxed md:text-xs">
          {unit.lore}
        </div>
        {isMastered ? (
          <div className="animate-fade-in border-tarnished-gold/30 text-gold-muted text-body-xs mt-auto border-t pt-2 font-serif leading-relaxed font-bold md:text-xs">
            {unit.secretLore ?? "???"}
          </div>
        ) : (
          <div className="border-iron text-iron-light text-card-md mt-auto border-t pt-2 italic">
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
    <div className="border-church-dark/30 mt-8 border-t pt-6">
      <h2 className="text-church-muted mb-2 flex items-center gap-2 text-sm font-bold tracking-wider">
        <Shield size={16} /> 教団兵の記録
      </h2>
      <p className="text-church-muted text-body-xs mb-4 text-center md:text-xs">
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
  const sortedUnits = Object.values(UNITS).sort((a, b) => a.tier - b.tier);
  const churchUnits = Object.values(CHURCH_UNITS).sort((a, b) => a.tier - b.tier);
  const db = loreDb.value;
  const handleClose = () => {
    initAudio();
    playSE("select");
    phase.value = "TITLE";
  };

  return (
    <main className="border-iron/30 bg-void text-parchment font-body relative mx-auto flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden border-x">
      <header className="border-iron/50 bg-void-surface flex shrink-0 items-center justify-between border-b p-3 md:p-4">
        <h1 className="text-parchment-bright flex items-center gap-2 text-lg font-bold tracking-wider md:text-xl">
          <BookOpen className="text-tarnished-gold-dim" /> 大解剖録
        </h1>
        <button
          onClick={handleClose}
          className="border-iron text-parchment-dim hover:bg-iron cursor-pointer rounded border px-4 py-1.5 text-xs transition-all md:text-sm"
        >
          閉じる
        </button>
      </header>
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <p className="text-parchment-muted mb-6 text-center font-serif text-xs leading-relaxed md:text-sm">
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
