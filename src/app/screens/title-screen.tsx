import { Skull, Book, Dna, ChevronRight } from "lucide-preact";
import { GradientBackground } from "../components/gradient-background";
import { UNITS } from "../../shared/data/units";
import { phase, gameLoading } from "../state/game-store";
import { useDelayedFlag } from "../hooks/use-delayed-flag";
import { loreDb } from "../state/lore";
import { initAudio, playSE } from "../engine/audio";
import { resumeOrSelectOrigin } from "../state/game-actions";

const enterGame = () => {
  initAudio();
  playSE("select");
  void resumeOrSelectOrigin();
};

const goToLore = () => {
  initAudio();
  playSE("select");
  phase.value = "LORE";
};

export function TitleScreen() {
  const db = loreDb.value || {};
  const totalMastered = Object.values(db).filter((l) => l?.mastered).length;
  const totalUnits = Object.values(UNITS).filter((u) => u.tier > 0).length;
  const loading = gameLoading.value;

  return (
    <main className="relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-zinc-950 p-4 font-serif text-zinc-300">
      <GradientBackground />

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="animate-icon-drift relative mb-8 h-24 w-24 md:h-32 md:w-32">
          <Skull className="absolute inset-0 h-full w-full text-zinc-800" />
          <Dna className="absolute inset-0 h-full w-full text-red-900/80" />
        </div>

        <h1 className="mb-10 text-4xl font-black tracking-[0.2em] text-zinc-100 drop-shadow-lg md:text-5xl">
          The Beast Grafter
        </h1>

        <div className="mb-12 max-w-md space-y-4 px-4 text-center text-[10px] leading-relaxed text-zinc-500 italic md:text-sm">
          <p>鉄格子越しに、松明の明かりと冷たい雨の匂いがする。</p>
          <p>教会の猟犬どもが、この地下室を嗅ぎつけるのも時間の問題だ。</p>
          <p>解剖台は冷え切っている。</p>
          <p>生き延びるためには、盾となる「肉」が必要だ。</p>
          <p>倫理も、信仰も、とうに捨てたはずだろう。</p>
          <p className="text-zinc-300">さあ、接ぎ木（グラフト）を始めろ。</p>
        </div>

        <TitleButtons loading={loading} mastered={totalMastered} total={totalUnits} />
      </div>
    </main>
  );
}

function TitleButtons({
  loading,
  mastered,
  total,
}: {
  loading: boolean;
  mastered: number;
  total: number;
}) {
  const showLoadingText = useDelayedFlag(loading);
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={enterGame}
        disabled={loading}
        className={`group rounded-sm border border-red-900 px-6 py-3 font-bold tracking-widest shadow-[0_0_15px_rgba(127,29,29,0.3)] transition-all ${
          loading
            ? "cursor-wait bg-red-950/5 text-red-900"
            : "cursor-pointer bg-red-950/20 text-red-500 hover:bg-red-900/40 hover:text-red-400"
        } ${showLoadingText.value ? "animate-pulse" : ""}`}
      >
        <span className="flex items-center justify-center gap-2">
          <span>{showLoadingText.value ? "……闇の中を探っている……" : "地下室へ降りる"}</span>
          {!loading && (
            <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={goToLore}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-zinc-800 px-6 py-3 tracking-widest text-zinc-500 transition-all hover:bg-zinc-900/50 hover:text-zinc-300"
      >
        <Book size={16} />
        <span>大解剖録を開く</span>
        <span className="text-[10px]">
          ({mastered}/{total})
        </span>
      </button>
    </div>
  );
}
