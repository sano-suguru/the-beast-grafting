import { Skull, Book } from "lucide-preact";
import { UNITS } from "../data/units";
import { phase } from "../state/game-store";
import { loreDb } from "../state/lore";
import { initAudio, playSE } from "../engine/audio";

const goToOrigin = () => {
  initAudio();
  playSE("select");
  phase.value = "ORIGIN";
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

  return (
    <main className="relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-zinc-950 p-4 font-serif text-zinc-300">
      <div className="mb-12 animate-pulse text-center">
        <Skull size={64} className="mx-auto mb-4 text-zinc-600" />
        <h1 className="mb-2 text-3xl font-black tracking-widest text-zinc-100 drop-shadow-lg md:text-5xl">
          The Beast Grafter
        </h1>
        <p className="text-xs font-bold tracking-[0.3em] text-red-800 md:text-sm">
          - 死獣接合術師 -
        </p>
      </div>
      <div className="mb-12 max-w-md space-y-4 px-4 text-center text-[10px] leading-relaxed text-zinc-500 md:text-sm">
        <p>鉄格子越しに、松明の明かりと冷たい雨の匂いがする。</p>
        <p>教会の猟犬どもが、この地下室を嗅ぎつけるのも時間の問題だ。</p>
        <p>解剖台は冷え切っている。生き延びるためには、盾となる「肉」が必要だ。</p>
        <p>倫理も、信仰も、とうに捨てたはずだろう。</p>
        <p className="text-zinc-300">さあ、接ぎ木（グラフト）を始めろ。</p>
      </div>
      <div className="flex flex-col gap-4">
        <button
          onClick={goToOrigin}
          className="cursor-pointer border border-red-900 bg-red-950/10 px-8 py-3 font-bold tracking-widest text-red-600 transition-all hover:bg-red-950/30"
        >
          地下室へ降りる
        </button>
        <button
          onClick={goToLore}
          className="flex cursor-pointer items-center justify-center gap-2 border border-zinc-800 px-8 py-3 tracking-widest text-zinc-400 transition-all hover:bg-zinc-900/50 hover:text-zinc-300"
        >
          <Book size={16} />
          大解剖録を開く{" "}
          <span className="ml-1 text-[10px]">
            ({totalMastered}/{totalUnits})
          </span>
        </button>
      </div>
    </main>
  );
}
