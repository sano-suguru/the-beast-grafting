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
        className="group relative h-full w-full cursor-pointer overflow-hidden rounded-sm border border-zinc-800 bg-black/60 p-5 text-center transition-all hover:border-red-900 hover:bg-zinc-900/80 hover:shadow-[0_0_20px_rgba(127,29,29,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="absolute -right-4 -bottom-4 opacity-5 transition-opacity group-hover:opacity-10">
          {Icon && <Icon className="h-40 w-40" />}
        </div>
        <div className="relative flex flex-col items-center">
          {Icon && (
            <Icon className="mb-4 h-10 w-10 text-zinc-500 transition-colors group-hover:text-red-700" />
          )}
          <span className="mb-2 block text-lg font-bold tracking-wider text-zinc-300 group-hover:text-white">
            {org.name}
          </span>
          <p className="mb-4 flex-1 text-xs text-zinc-500 italic">"{org.lore}"</p>
          <div className="w-full border-t border-zinc-800 bg-zinc-950/80 px-1 py-2 text-center font-mono text-[10px] text-red-700 sm:text-xs">
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
    <main className="relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-y-auto bg-zinc-950 p-4 font-serif text-zinc-300">
      <GradientBackground
        gradient="from-red-950/30 via-zinc-950 to-black"
        glowColor="rgba(127,29,29,0.1)"
      />
      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center">
        <h1 className="mt-8 mb-8 border-b border-zinc-800 pb-2 text-2xl font-bold tracking-[0.2em] text-red-800 sm:text-3xl">
          素性の選択
        </h1>
        {error && (
          <p className="mb-4 text-sm text-red-500">
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
        <p className="mt-4 text-xs tracking-widest text-zinc-600">―― 死者の肉を継ぎ、獣と成れ。</p>
      </div>
    </main>
  );
}
