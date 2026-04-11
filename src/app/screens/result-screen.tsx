import { Trophy, Flame } from "lucide-preact";
import { GradientBackground } from "../components/gradient-background";
import { trophy, phase, lastEnemyTeamType } from "../state/game-store";
import { initAudio, playSE } from "../engine/audio";

function WinContent() {
  return (
    <>
      <div className="animate-icon-drift mb-6 h-24 w-24 md:h-32 md:w-32">
        <Trophy className="text-tarnished-gold-dim h-full w-full" />
      </div>
      <h1 className="text-parchment-bright mb-4 text-3xl font-bold tracking-[0.2em] md:text-4xl">
        傑作の完成
      </h1>
      <div className="text-parchment-muted max-w-md space-y-4 px-4 font-serif text-xs leading-relaxed italic md:text-sm">
        <p>最後の激突が終わった。</p>
        <p>
          死体の山の上に、あなたが接ぎ木し続けた「究極の傑作」が立っている。それはもはや元の生物の原型を留めておらず、ただ美しく、冒涜的だ。
        </p>
        <p>遠くで悲鳴と、教会の鐘が狂ったように鳴り響き始めた。</p>
        <p>あなたは静かに解剖台の血を拭き取る。明日もまた、新鮮な死体が手に入るだろう。</p>
      </div>
    </>
  );
}

function LossContent() {
  const isChurch = lastEnemyTeamType.value === "教団";
  return (
    <>
      <div className="animate-icon-drift mb-6 h-24 w-24 md:h-32 md:w-32">
        <Flame className="text-blood-deep h-full w-full" />
      </div>
      <h1 className="text-blood-bright mb-4 text-3xl font-bold tracking-[0.2em] md:text-4xl">
        異端認定
      </h1>
      <div className="text-parchment-muted max-w-md space-y-4 px-4 font-serif text-xs leading-relaxed italic md:text-sm">
        {isChurch ? (
          <>
            <p>重い木の扉が破られる音がした。</p>
            <p>松明の炎が、血に塗れたあなたの聖域を容赦なく照らし出す。</p>
            <p>あなたの不完全なキメラたちは、あっけなく炎に巻かれた。</p>
            <p>刃があなたの首筋に触れる。偉大なる死獣接合術の系譜は、ここで灰となる。</p>
          </>
        ) : (
          <>
            <p>暗闇の中で、聞き慣れた肉を裂く音がした。</p>
            <p>同業者の手によって、あなたのキメラたちは無残に解体されていく。</p>
            <p>最後に見えたのは、自分の傑作の残骸を貪り喰う、おぞましい異形の群れだった。</p>
            <p>同じ深淵を覗く者に喰われる——それが、この道の末路だ。</p>
          </>
        )}
      </div>
    </>
  );
}

function ResultButton({ isWin }: { isWin: boolean }) {
  const shadow = isWin ? "shadow-glow-gold-hover" : "shadow-glow-blood-sm";
  return (
    <button
      onClick={() => {
        initAudio();
        playSE("select");
        phase.value = "TITLE";
      }}
      className={`border-iron text-parchment-dim hover:bg-void-surface hover:text-parchment mt-12 cursor-pointer rounded-sm border px-6 py-3 text-sm tracking-widest transition-all ${shadow}`}
      type="button"
    >
      別の遺体安置所を探す
    </button>
  );
}

export function ResultScreen() {
  const isWin = trophy.value >= 10;

  return (
    <main className="animate-fade-in bg-void text-parchment font-body relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden p-4 text-center">
      <GradientBackground
        gradient={isWin ? "from-tarnished-gold-deep/30 via-void to-black" : undefined}
        glowColor={
          isWin ? "color-mix(in srgb, var(--color-tarnished-gold) 8%, transparent)" : undefined
        }
      />
      <div className="relative z-10 flex flex-col items-center">
        {isWin ? <WinContent /> : <LossContent />}
        <ResultButton isWin={isWin} />
      </div>
    </main>
  );
}
