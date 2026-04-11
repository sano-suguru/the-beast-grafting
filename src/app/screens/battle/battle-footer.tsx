import { FastForward, ArrowRight } from "lucide-preact";
import { fastForward, battleBusy } from "../../state/game-store";
import { concludeBattle } from "../../state/battle-actions";
import { initAudio, playSE } from "../../engine/audio";

export function BattleFooter({ isFinished }: { isFinished: boolean }) {
  if (!isFinished) {
    return (
      <footer className="border-iron/50 bg-void-surface flex shrink-0 justify-center border-t p-2 md:p-3">
        <button
          onClick={() => {
            fastForward.value = true;
          }}
          className="border-iron bg-iron/60 hover:bg-iron text-parchment-bright flex cursor-pointer items-center gap-2 rounded border px-6 py-2 text-xs transition-colors active:scale-95"
        >
          <FastForward size={14} /> 早送り
        </button>
      </footer>
    );
  }
  return (
    <footer className="border-iron/50 bg-void-surface flex shrink-0 justify-center border-t p-2 md:p-3">
      <button
        disabled={battleBusy.value}
        onClick={() => {
          initAudio();
          playSE("select");
          concludeBattle();
        }}
        className="border-blood-deep bg-blood-deep/30 text-blood-bright hover:bg-blood-deep/50 disabled:text-disabled-fg disabled:border-iron/30 flex cursor-pointer items-center gap-2 rounded border px-6 py-2 text-xs font-bold tracking-widest transition-all active:scale-95 disabled:cursor-not-allowed"
      >
        死体を検分する <ArrowRight size={14} className="ml-1 inline" />
      </button>
    </footer>
  );
}
