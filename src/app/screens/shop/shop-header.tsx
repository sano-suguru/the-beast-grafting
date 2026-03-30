import { Heart, Trophy, Droplet, HelpCircle } from "lucide-preact";
import { ORIGINS } from "../../../shared/data/origins";
import {
  round,
  origin,
  sanity,
  trophy,
  blood,
  showHelpOverlay,
  onboardingStep,
} from "../../state/game-store";
import { playSE } from "../../engine/audio";

function toggleHelp() {
  playSE("select");
  const next = !showHelpOverlay.value;
  showHelpOverlay.value = next;
  if (next) onboardingStep.value = null;
}

export function ShopHeader() {
  const currentSanity = sanity.value;
  const isHelpActive = showHelpOverlay.value;
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 p-2 md:p-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <span className="text-base font-bold tracking-wider text-zinc-100 md:text-lg">
            第{round.value}夜
          </span>
          <span className="text-[9px] text-zinc-500 md:text-[10px]">
            {origin.value ? ORIGINS[origin.value]?.name : ""}
          </span>
        </div>
        <button
          onClick={toggleHelp}
          className={`cursor-pointer rounded p-1 transition-colors ${isHelpActive ? "text-red-600" : "text-zinc-600 hover:text-zinc-400"}`}
          aria-label="ヘルプ"
        >
          <HelpCircle size={14} />
        </button>
      </div>
      <div className="flex gap-3 md:gap-4">
        <div className={`flex flex-col items-center ${currentSanity <= 2 ? "animate-pulse" : ""}`}>
          <Heart
            size={14}
            className={currentSanity <= 2 ? "mb-0.5 text-red-600" : "mb-0.5 text-zinc-500"}
          />
          <span
            className={`text-[10px] font-bold md:text-xs ${currentSanity <= 2 ? "text-red-500" : ""}`}
          >
            {currentSanity}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <Trophy size={14} className="mb-0.5 text-zinc-500" />
          <span className="text-[10px] font-bold md:text-xs">{trophy.value}</span>
        </div>
        <div className="flex flex-col items-center">
          <Droplet size={14} className="mb-0.5 text-red-700" />
          <span className="text-[10px] font-bold text-red-600 md:text-xs">{blood.value}</span>
        </div>
      </div>
    </header>
  );
}
