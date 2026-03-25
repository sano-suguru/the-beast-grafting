import { ORIGINS } from "../data/origins";
import { startGame } from "../state/game-actions";

export function OriginScreen() {
  return (
    <div className="relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-y-auto bg-zinc-950 p-4 font-serif text-zinc-300">
      <h2 className="mt-8 mb-8 border-b border-zinc-800 pb-2 text-2xl font-bold text-zinc-100">
        素性の選択
      </h2>
      <div className="mb-8 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        {Object.values(ORIGINS).map((org) => (
          <div
            key={org.id}
            onClick={() => startGame(org.id)}
            className="group cursor-pointer border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-red-900 hover:bg-zinc-900"
          >
            <h3 className="mb-1 text-base font-bold text-red-800 group-hover:text-red-600 md:text-lg">
              {org.name}
            </h3>
            <p className="mb-2 font-sans text-xs text-zinc-400 md:text-sm">{org.desc}</p>
            <p className="mt-2 border-t border-zinc-800 pt-2 text-[10px] leading-relaxed text-zinc-600 italic md:text-xs">
              {org.lore}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
