import { Trophy, Flame } from "lucide-preact";
import { GradientBackground } from "../components/gradient-background";
import { trophy, phase, lastEnemyTeamType } from "../state/game-store";
import { initAudio, playSE } from "../engine/audio";

function WinContent() {
  return (
    <>
      <div className="animate-icon-drift mb-6 h-24 w-24 md:h-32 md:w-32">
        <Trophy className="h-full w-full text-zinc-500" />
      </div>
      <h1 className="mb-4 text-3xl font-bold tracking-[0.2em] text-zinc-100 md:text-4xl">
        傑作の完成
      </h1>
      <div className="max-w-md space-y-4 px-4 text-xs leading-relaxed text-zinc-400 italic md:text-sm">
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
        <Flame className="h-full w-full text-red-800" />
      </div>
      <h1 className="mb-4 text-3xl font-bold tracking-[0.2em] text-red-700 md:text-4xl">
        異端認定
      </h1>
      <div className="max-w-md space-y-4 px-4 text-xs leading-relaxed text-zinc-400 italic md:text-sm">
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
  const shadow = isWin
    ? "shadow-[0_0_15px_rgba(113,113,122,0.2)]"
    : "shadow-[0_0_15px_rgba(127,29,29,0.3)]";
  return (
    <button
      onClick={() => {
        initAudio();
        playSE("select");
        phase.value = "TITLE";
      }}
      className={`mt-12 cursor-pointer rounded-sm border border-zinc-700 px-6 py-3 text-sm tracking-widest text-zinc-400 transition-all hover:bg-zinc-900 hover:text-zinc-300 ${shadow}`}
      type="button"
    >
      別の遺体安置所を探す
    </button>
  );
}

export function ResultScreen() {
  const isWin = trophy.value >= 10;

  return (
    <main className="animate-fade-in relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-zinc-950 p-4 text-center font-serif text-zinc-300">
      <GradientBackground
        gradient={isWin ? "from-zinc-800/30 via-zinc-950 to-black" : undefined}
        glowColor={isWin ? "rgba(113,113,122,0.1)" : undefined}
      />
      <div className="relative z-10 flex flex-col items-center">
        {isWin ? <WinContent /> : <LossContent />}
        <ResultButton isWin={isWin} />
      </div>
    </main>
  );
}
