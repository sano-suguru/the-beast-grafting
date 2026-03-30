import { ORIGINS } from "../../shared/data/origins";
import { startGame } from "../state/game-actions";
import { gameLoading, startGameError } from "../state/game-store";

export function OriginScreen() {
  const loading = gameLoading.value;
  const error = startGameError.value;
  return (
    <main className="relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-y-auto bg-zinc-950 p-4 font-serif text-zinc-300">
      <h1 className="mt-8 mb-8 border-b border-zinc-800 pb-2 text-2xl font-bold text-zinc-100">
        素性の選択
      </h1>
      {error && (
        <p className="mb-4 text-sm text-red-500">
          サーバーに接続できませんでした。再度お試しください。
        </p>
      )}
      <ul role="list" className="mb-8 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        {Object.values(ORIGINS).map((org) => (
          <li key={org.id}>
            <button
              type="button"
              disabled={loading}
              onClick={() => void startGame(org.id)}
              className="group w-full cursor-pointer border border-zinc-800 bg-zinc-900/50 p-4 text-left transition-all hover:border-red-900 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="mb-1 block text-base font-bold text-red-800 group-hover:text-red-600 md:text-lg">
                {org.name}
              </span>
              <p className="mb-2 font-sans text-xs text-zinc-400 md:text-sm">{org.desc}</p>
              <p className="mt-2 border-t border-zinc-800 pt-2 text-[10px] leading-relaxed text-zinc-600 italic md:text-xs">
                {org.lore}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
