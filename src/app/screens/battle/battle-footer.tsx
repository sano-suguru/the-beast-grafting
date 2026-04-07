import { FastForward, ArrowRight } from "lucide-preact";
import { fastForward, battleBusy } from "../../state/game-store";
import { concludeBattle } from "../../state/battle-actions";
import { initAudio, playSE } from "../../engine/audio";

export function BattleFooter({ isFinished }: { isFinished: boolean }) {
  if (!isFinished) {
    return (
      <footer className="flex shrink-0 justify-center border-t border-zinc-800 bg-zinc-900 p-2 md:p-3">
        <button
          onClick={() => {
            fastForward.value = true;
          }}
          className="flex cursor-pointer items-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-6 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-700 active:scale-95"
        >
          <FastForward size={14} /> 早送り
        </button>
      </footer>
    );
  }
  return (
    <footer className="flex shrink-0 justify-center border-t border-zinc-800 bg-zinc-900 p-2 md:p-3">
      <button
        disabled={battleBusy.value}
        onClick={() => {
          initAudio();
          playSE("select");
          concludeBattle();
        }}
        className="flex cursor-pointer items-center gap-2 rounded border border-red-900 bg-red-950/30 px-6 py-2 text-xs font-bold tracking-widest text-red-500 transition-all hover:bg-red-950/50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        死体を検分する <ArrowRight size={14} className="ml-1 inline" />
      </button>
    </footer>
  );
}
