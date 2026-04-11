import { Heart, Trophy } from "lucide-preact";
import { currentEnemyTeam, round, life, battleLoading, battleLoadError } from "../state/game-store";
import { startActualBattle, retryBattle } from "../state/battle-actions";
import { initAudio, playSE } from "../engine/audio";
import { selectPreBattleNarrative } from "../data/pre-battle-narrative";
import { toLifeTier } from "../../shared/types";
import { invariant } from "../../shared/invariant";
import { useDelayedFlag } from "../hooks/use-delayed-flag";
import { GradientBackground } from "../components/gradient-background";

const TIER_CLASS = {
  high: "text-parchment-muted",
  mid: "text-gold-muted",
  low: "animate-pulse font-bold text-blood-bright",
} as const;

function OpponentStats({ round, life, trophy }: { round: number; life: number; trophy: number }) {
  return (
    <span className="text-parchment-dim mt-2 flex items-center justify-center gap-3 text-xs font-normal tracking-wider">
      第{round}夜
      <span className="flex items-center gap-1">
        <Heart size={12} />
        {life}
      </span>
      <span className="flex items-center gap-1">
        <Trophy size={12} />
        {trophy}
      </span>
    </span>
  );
}

function PreBattleLoading({ showText }: { showText: boolean }) {
  return (
    <main className="bg-void text-parchment-dim relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden">
      <GradientBackground />
      {showText && <p className="relative z-10 animate-pulse tracking-wider">……準備中……</p>}
    </main>
  );
}

function PreBattleError() {
  return (
    <main className="bg-void text-parchment-dim relative flex h-[100dvh] w-full flex-col items-center justify-center gap-6 overflow-hidden">
      <GradientBackground />
      <p className="relative z-10">戦闘データの取得に失敗しました</p>
      <button
        onClick={retryBattle}
        className="border-blood-deep bg-blood-deep/20 text-blood-bright hover:bg-blood-bright/30 hover:text-blood-bright shadow-glow-blood-sm relative z-10 cursor-pointer rounded-sm border px-8 py-3 text-sm tracking-widest transition-all"
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
  const narrative = selectPreBattleNarrative(life.value, team.teamType, round.value);
  const tier = toLifeTier(life.value);

  return (
    <main className="animate-fade-in bg-void text-parchment font-body relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden p-6 text-center">
      <GradientBackground />
      <div
        className={`relative z-10 max-w-md space-y-6 font-serif text-xs leading-loose tracking-wide md:text-base ${TIER_CLASS[tier]}`}
      >
        <p>{narrative.intro}</p>
        <p className="border-blood-deep/30 text-blood-bright mt-4 border-y py-4 font-bold">
          今夜の狩りの気配：
          <br />
          <span className="text-blood-bright mt-2 block text-sm tracking-widest md:text-lg">
            {team.teamName}
          </span>
          {team.round != null && (
            <OpponentStats round={team.round} life={team.life} trophy={team.trophy} />
          )}
        </p>
        <p>{narrative.closing}</p>
      </div>
      <button
        onClick={() => {
          initAudio();
          playSE("select");
          startActualBattle();
        }}
        className="border-blood-deep bg-blood-deep/20 text-blood-bright hover:bg-blood-bright/30 hover:text-blood-bright shadow-glow-blood-sm relative z-10 mt-12 cursor-pointer rounded-sm border px-8 py-3 text-sm tracking-widest transition-all"
      >
        見届ける。
      </button>
    </main>
  );
}
