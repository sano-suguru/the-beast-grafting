import { Heart, Trophy, Droplet, HelpCircle, LogOut } from "lucide-preact";
import { toLifeTier } from "../../../shared/types";
import { ORIGINS } from "../../../shared/data/origins";
import {
  round,
  origin,
  life,
  trophy,
  blood,
  showHelpOverlay,
  onboardingStep,
  shopLocked,
  showRetireConfirm,
  resourceError,
} from "../../state/game-store";
import { playSE } from "../../engine/audio";

function toggleHelp() {
  playSE("select");
  const next = !showHelpOverlay.value;
  showHelpOverlay.value = next;
  if (next) onboardingStep.value = null;
}

function LifeDisplay({ currentLife, isAlert }: { currentLife: number; isAlert: boolean }) {
  const pulse = toLifeTier(currentLife) !== "high" || isAlert;
  return (
    <div
      className={`flex flex-col items-center ${pulse ? "animate-pulse" : ""} ${isAlert ? "rounded border border-red-500 p-0.5" : ""}`}
    >
      <Heart size={14} className={`mb-0.5 ${pulse ? "text-red-600" : "text-zinc-500"}`} />
      <span className={`text-[10px] font-bold md:text-xs ${pulse ? "text-red-500" : ""}`}>
        {currentLife}
      </span>
    </div>
  );
}

function ResourceBar({ resErr }: { resErr: "blood" | "life" | null }) {
  return (
    <div className="flex gap-3 md:gap-4">
      <LifeDisplay currentLife={life.value} isAlert={resErr === "life"} />
      <div className="flex flex-col items-center">
        <Trophy size={14} className="mb-0.5 text-zinc-500" />
        <span className="text-[10px] font-bold md:text-xs">{trophy.value}</span>
      </div>
      <div
        className={`flex flex-col items-center ${resErr === "blood" ? "animate-pulse rounded border border-red-500 p-0.5" : ""}`}
      >
        <Droplet size={14} className="mb-0.5 text-red-700" />
        <span className="text-[10px] font-bold text-red-600 md:text-xs">{blood.value}</span>
      </div>
    </div>
  );
}

export function ShopHeader() {
  const isHelpActive = showHelpOverlay.value;
  const locked = shopLocked.value;
  const resErr = resourceError.value;
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
      <div className="flex items-center gap-4 md:gap-5">
        <ResourceBar resErr={resErr} />
        <div className="h-5 w-px bg-zinc-700" />
        <button
          onClick={() => {
            playSE("select");
            showRetireConfirm.value = true;
          }}
          disabled={locked}
          className={`flex items-center gap-1 rounded border px-2 py-1 text-[10px] tracking-wider transition-colors md:text-xs ${
            locked
              ? "cursor-not-allowed border-zinc-800 text-zinc-700"
              : "cursor-pointer border-zinc-700 text-zinc-500 hover:border-red-900 hover:text-red-700"
          }`}
        >
          <LogOut size={12} />
          逃走
        </button>
      </div>
    </header>
  );
}
