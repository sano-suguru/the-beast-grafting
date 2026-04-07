import { Skull, Book, Dna, ChevronRight } from "lucide-preact";
import { GradientBackground } from "../components/gradient-background";
import { UNITS } from "../../shared/data/units";
import { phase, gameLoading } from "../state/game-store";
import { showAccountOverlay } from "../state/auth-store";
import { useDelayedFlag } from "../hooks/use-delayed-flag";
import { loreDb } from "../state/lore";
import { initAudio, playSE } from "../engine/audio";
import { resumeOrSelectOrigin } from "../state/game-actions";
import { IdentityBadge } from "./title/identity-badge";
import { AccountOverlay } from "./title/account-overlay";

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
  const totalUnits = Object.values(UNITS).length;
  const loading = gameLoading.value;

  return (
    <main className="bg-void text-parchment relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden p-4 font-serif">
      <GradientBackground />
      <IdentityBadge />
      {showAccountOverlay.value && <AccountOverlay />}

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="animate-icon-drift relative mb-8 h-24 w-24 md:h-32 md:w-32">
          <Skull className="text-iron absolute inset-0 h-full w-full" />
          <Dna className="text-blood-deep/80 absolute inset-0 h-full w-full" />
        </div>

        <h1
          className="text-parchment-bright mb-10 text-4xl font-black tracking-[0.2em] md:text-5xl"
          style={{
            textShadow:
              "0 0 30px color-mix(in srgb, var(--color-tarnished-gold) 30%, transparent), 0 2px 4px rgba(0,0,0,0.8)",
          }}
        >
          The Beast Grafter
        </h1>

        <div className="text-parchment-muted mb-12 max-w-md space-y-4 px-4 text-center text-[10px] leading-relaxed italic md:text-sm">
          <p>鉄格子越しに、松明の明かりと冷たい雨の匂いがする。</p>
          <p>教会の猟犬どもが、この地下室を嗅ぎつけるのも時間の問題だ。</p>
          <p>解剖台は冷え切っている。</p>
          <p>生き延びるためには、盾となる「肉」が必要だ。</p>
          <p>倫理も、信仰も、とうに捨てたはずだろう。</p>
          <p className="text-parchment">さあ、接ぎ木（グラフト）を始めろ。</p>
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
        className={`group border-blood-deep shadow-glow-blood-sm rounded-sm border px-6 py-3 font-bold tracking-widest transition-all ${
          loading
            ? "bg-blood-deep/5 text-blood-deep cursor-wait"
            : "bg-blood-deep/20 text-blood-bright hover:bg-blood-bright/30 hover:text-blood-bright cursor-pointer"
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
        className="border-iron text-parchment-dim hover:bg-void-surface/50 hover:text-parchment flex cursor-pointer items-center justify-center gap-2 rounded-sm border px-6 py-3 tracking-widest transition-all"
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
