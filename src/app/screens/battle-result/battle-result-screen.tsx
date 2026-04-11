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
import { initAudio, playSE } from "../../engine/audio";
import { invariant } from "../../../shared/invariant";
import { computeBattleStats } from "./compute-stats";
import { GradientBackground } from "../../components/gradient-background";
import { UnitStatsList } from "./unit-stats-list";
import { RewardSummary } from "./reward-summary";
import { TierUnlockBanner } from "./tier-unlock-banner";

const RESULT_CONFIG = {
  WIN: {
    icon: Trophy,
    iconColor: "text-tarnished-gold-dim",
    label: "勝利",
    labelColor: "text-parchment-bright",
    gradient: "from-tarnished-gold-deep/30 via-void to-black",
    glowColor: "color-mix(in srgb, var(--color-tarnished-gold) 8%, transparent)",
  },
  LOSE: {
    icon: Flame,
    iconColor: "text-blood-deep",
    label: "敗北",
    labelColor: "text-blood-bright",
    gradient: "from-blood-deep/40 via-void to-black",
    glowColor: "color-mix(in srgb, var(--color-blood-bright) 15%, transparent)",
  },
  DRAW: {
    icon: Scale,
    iconColor: "text-iron-light",
    label: "引き分け",
    labelColor: "text-parchment-dim",
    gradient: "from-iron/30 via-void to-black",
    glowColor: "color-mix(in srgb, var(--color-iron-light) 8%, transparent)",
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
    <main className="animate-fade-in bg-void text-parchment font-body relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden p-4">
      <GradientBackground gradient={cfg.gradient} glowColor={cfg.glowColor} />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 md:max-w-lg">
        <ResultHeader result={result} />

        {data && <RewardSummary trophyDelta={data.trophyDelta} lifeDelta={data.lifeDelta} />}
        {data?.unlockedTier && <TierUnlockBanner tier={data.unlockedTier} />}

        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
          <UnitStatsList label="あなたの傑作" units={stats.playerUnits} />
          <UnitStatsList
            label={currentEnemyTeam.value?.teamName ?? "敵陣"}
            units={stats.enemyUnits}
          />
        </div>

        <button
          disabled={battleBusy.value}
          onClick={() => {
            initAudio();
            playSE("select");
            proceedFromBattleResult();
          }}
          className="border-iron text-parchment-dim hover:bg-void-surface hover:text-parchment shadow-glow-iron-sm disabled:text-disabled-fg disabled:border-iron/30 mt-4 cursor-pointer rounded-sm border px-6 py-3 text-sm tracking-widest transition-all disabled:cursor-not-allowed"
          type="button"
        >
          {data?.gameEnded ? "終幕を見届ける" : "次の夜へ進む"}
        </button>
      </div>
    </main>
  );
}
