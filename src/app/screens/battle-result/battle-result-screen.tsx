import { useMemo } from "preact/hooks";
import { Trophy, Flame, Scale } from "lucide-preact";
import {
  battleFrames,
  battleResult,
  battleConcludeData,
  battleBusy,
  currentEnemyTeam,
} from "../../state/game-store";
import { proceedFromBattleResult } from "../../state/battle-actions";
import { invariant } from "../../../shared/invariant";
import { computeBattleStats } from "./compute-stats";
import { GradientBackground } from "../../components/gradient-background";
import { UnitStatsList } from "./unit-stats-list";
import { RewardSummary } from "./reward-summary";

const RESULT_CONFIG = {
  WIN: {
    icon: Trophy,
    iconColor: "text-zinc-500",
    label: "勝利",
    labelColor: "text-zinc-100",
    gradient: "from-zinc-800/30 via-zinc-950 to-black",
    glowColor: "rgba(113,113,122,0.1)",
  },
  LOSE: {
    icon: Flame,
    iconColor: "text-red-800",
    label: "敗北",
    labelColor: "text-red-700",
    gradient: "from-red-950/40 via-zinc-950 to-black",
    glowColor: "rgba(127,29,29,0.15)",
  },
  DRAW: {
    icon: Scale,
    iconColor: "text-zinc-600",
    label: "引き分け",
    labelColor: "text-zinc-400",
    gradient: "from-zinc-900/30 via-zinc-950 to-black",
    glowColor: "rgba(113,113,122,0.08)",
  },
} as const;

function ResultHeader({ result }: { result: "WIN" | "LOSE" | "DRAW" }) {
  const cfg = RESULT_CONFIG[result];
  const Icon = cfg.icon;
  return (
    <div className="mb-6 flex flex-col items-center gap-3">
      <div className="animate-icon-drift h-16 w-16">
        <Icon className={`h-full w-full ${cfg.iconColor}`} />
      </div>
      <h1 className={`text-2xl font-bold tracking-[0.2em] ${cfg.labelColor}`}>{cfg.label}</h1>
    </div>
  );
}

export function BattleResultScreen() {
  invariant(battleResult.value, "battleResult must be set in BATTLE_RESULT phase");
  const result = battleResult.value;
  const frames = battleFrames.value;
  const data = battleConcludeData.value;
  const stats = useMemo(() => computeBattleStats(frames), [frames]);
  const cfg = RESULT_CONFIG[result];

  return (
    <main className="animate-fade-in relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-zinc-950 p-4 font-serif text-zinc-300">
      <GradientBackground gradient={cfg.gradient} glowColor={cfg.glowColor} />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 md:max-w-lg">
        <ResultHeader result={result} />

        {data && <RewardSummary trophyDelta={data.trophyDelta} sanityDelta={data.sanityDelta} />}

        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
          <UnitStatsList label="あなたの傑作" units={stats.playerUnits} />
          <UnitStatsList
            label={currentEnemyTeam.value?.teamName ?? "敵陣"}
            units={stats.enemyUnits}
          />
        </div>

        <button
          disabled={battleBusy.value}
          onClick={() => proceedFromBattleResult()}
          className="mt-4 cursor-pointer rounded-sm border border-zinc-700 px-6 py-3 text-sm tracking-widest text-zinc-400 shadow-[0_0_15px_rgba(113,113,122,0.2)] transition-all hover:bg-zinc-900 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
        >
          {data?.gameEnded ? "終幕を見届ける" : "次の夜へ進む"}
        </button>
      </div>
    </main>
  );
}
