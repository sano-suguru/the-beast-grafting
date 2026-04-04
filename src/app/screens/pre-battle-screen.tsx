import {
  currentEnemyTeam,
  round,
  sanity,
  battleLoading,
  battleLoadError,
} from "../state/game-store";
import { startActualBattle, retryBattle } from "../state/battle-actions";
import { selectPreBattleNarrative } from "../data/pre-battle-narrative";
import { toSanityTier } from "../../shared/types";
import { invariant } from "../../shared/invariant";
import { useDelayedFlag } from "../hooks/use-delayed-flag";
import { GradientBackground } from "../components/gradient-background";

const TIER_CLASS = {
  high: "text-zinc-400",
  mid: "text-amber-600/80",
  low: "animate-pulse font-bold text-red-500",
} as const;

function PreBattleLoading({ showText }: { showText: boolean }) {
  return (
    <main className="relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-zinc-950 text-zinc-500">
      <GradientBackground />
      {showText && <p className="relative z-10 animate-pulse tracking-widest">……準備中……</p>}
    </main>
  );
}

function PreBattleError() {
  return (
    <main className="relative flex h-[100dvh] w-full flex-col items-center justify-center gap-6 overflow-hidden bg-zinc-950 text-zinc-400">
      <GradientBackground />
      <p className="relative z-10">戦闘データの取得に失敗しました</p>
      <button
        onClick={retryBattle}
        className="relative z-10 cursor-pointer rounded-sm border border-red-900 bg-red-950/20 px-8 py-3 text-sm tracking-widest text-red-500 shadow-[0_0_15px_rgba(127,29,29,0.3)] transition-all hover:bg-red-950/40 hover:text-red-400"
      >
        再試行
      </button>
    </main>
  );
}

export function PreBattleScreen() {
  const team = currentEnemyTeam.value;
  const loading = battleLoading.value;
  const error = battleLoadError.value;
  const showLoadingText = useDelayedFlag(loading || (!team && !error));

  if (loading || (!team && !error)) return <PreBattleLoading showText={showLoadingText.value} />;
  if (error) return <PreBattleError />;

  invariant(team, "PreBattleScreen: team must exist after loading/error guards");
  const narrative = selectPreBattleNarrative(sanity.value, team.teamType, round.value);
  const tier = toSanityTier(sanity.value);

  return (
    <main className="animate-fade-in relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-zinc-950 p-6 text-center font-serif text-zinc-300">
      <GradientBackground />
      <div
        className={`relative z-10 max-w-md space-y-6 text-xs leading-loose tracking-wide md:text-base ${TIER_CLASS[tier]}`}
      >
        <p>{narrative.intro}</p>
        <p className="mt-4 border-y border-red-900/30 py-4 font-bold text-red-800">
          今夜の狩りの気配：
          <br />
          <span className="mt-2 block text-sm tracking-widest text-red-500 md:text-lg">
            {team.teamName}
          </span>
        </p>
        <p>{narrative.closing}</p>
      </div>
      <button
        onClick={startActualBattle}
        className="relative z-10 mt-12 cursor-pointer rounded-sm border border-red-900 bg-red-950/20 px-8 py-3 text-sm tracking-widest text-red-500 shadow-[0_0_15px_rgba(127,29,29,0.3)] transition-all hover:bg-red-950/40 hover:text-red-400"
      >
        見届ける。
      </button>
    </main>
  );
}
