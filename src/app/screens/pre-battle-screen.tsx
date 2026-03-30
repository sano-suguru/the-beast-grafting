import { currentEnemyTeam, round, sanity } from "../state/game-store";
import { startActualBattle } from "../state/battle-actions";
import { selectPreBattleNarrative, toSanityTier } from "../../shared/engine/pre-battle-narrative";
import { invariant } from "../../shared/invariant";

const TIER_CLASS = {
  high: "text-zinc-400",
  mid: "text-amber-600/80",
  low: "animate-pulse font-bold text-red-500",
} as const;

export function PreBattleScreen() {
  const team = currentEnemyTeam.value;
  invariant(team != null, "PreBattleScreen rendered without currentEnemyTeam");
  const narrative = selectPreBattleNarrative(sanity.value, team.teamType, round.value);
  const tier = toSanityTier(sanity.value);

  return (
    <main className="animate-fade-in relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-zinc-950 p-6 text-center font-serif text-zinc-300">
      <div
        className={`max-w-md space-y-6 text-xs leading-loose tracking-wide md:text-base ${TIER_CLASS[tier]}`}
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
        className="mt-12 cursor-pointer border border-red-900 bg-red-950/20 px-8 py-3 text-sm tracking-widest text-red-500 transition-all hover:bg-red-950/40"
      >
        結果を見届ける
      </button>
    </main>
  );
}
