import { Shovel, Flame, Scissors, Eye } from "lucide-preact";
import { GradientBackground } from "../components/gradient-background";
import { ResourceText } from "../components/resource-text";
import type { FunctionComponent } from "preact";
import type { LucideProps } from "lucide-preact";

import { ORIGINS } from "../../shared/data/origins";
import { startGame } from "../state/game-actions";
import { gameLoading, startGameError } from "../state/game-store";
import { initAudio, playSE } from "../engine/audio";

const ORIGIN_ICONS: Record<string, FunctionComponent<LucideProps>> = {
  Shovel,
  Flame,
  Scissors,
  Eye,
};

function OriginCard({
  org,
  loading,
}: {
  org: (typeof ORIGINS)[keyof typeof ORIGINS];
  loading: boolean;
}) {
  const Icon = ORIGIN_ICONS[org.icon];
  return (
    <li key={org.id}>
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          initAudio();
          playSE("clash");
          void startGame(org.id);
        }}
        className="group border-iron bg-void-surface/80 hover:border-tarnished-gold-dim hover:bg-void-surface hover:shadow-glow-gold-hover disabled:text-disabled-fg disabled:border-iron/30 relative h-full w-full cursor-pointer overflow-hidden rounded-sm border p-5 text-center transition-all disabled:cursor-not-allowed"
      >
        <div className="absolute -right-4 -bottom-4 opacity-5 transition-opacity group-hover:opacity-10">
          {Icon && <Icon className="h-40 w-40" />}
        </div>
        <div className="relative flex flex-col items-center">
          {Icon && (
            <Icon className="text-parchment-dim group-hover:text-tarnished-gold mb-4 h-10 w-10 transition-colors" />
          )}
          <span className="text-parchment-bright mb-2 block text-lg font-bold tracking-wider group-hover:text-white">
            {org.name}
          </span>
          <p className="text-parchment-muted mb-4 flex-1 font-serif text-xs italic">"{org.lore}"</p>
          <div className="border-iron bg-void/80 text-blood-bright text-body-xs w-full border-t px-1 py-2 text-center font-mono sm:text-xs">
            <ResourceText text={org.desc} />
          </div>
        </div>
      </button>
    </li>
  );
}

export function OriginScreen() {
  const loading = gameLoading.value;
  const error = startGameError.value;
  return (
    <main className="bg-void text-parchment font-body relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-y-auto p-4">
      <GradientBackground
        gradient="from-blood-deep/30 via-void to-black"
        glowColor="color-mix(in srgb, var(--color-tarnished-gold) 6%, transparent)"
      />
      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center">
        <h1 className="border-iron text-blood-bright mt-8 mb-8 border-b pb-2 text-2xl font-bold tracking-[0.2em] sm:text-3xl">
          素性の選択
        </h1>
        {error && (
          <p className="text-blood-bright mb-4 text-sm">
            サーバーに接続できませんでした。再度お試しください。
          </p>
        )}
        <ul
          role="list"
          className="mb-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4"
        >
          {Object.values(ORIGINS).map((org) => (
            <OriginCard key={org.id} org={org} loading={loading} />
          ))}
        </ul>
        <p className="text-parchment-ghost mt-4 text-xs tracking-widest">
          ―― 死者の肉を継ぎ、獣と成れ。
        </p>
      </div>
    </main>
  );
}
