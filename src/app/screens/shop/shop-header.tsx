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
      className={`flex flex-col items-center ${pulse ? "animate-pulse" : ""} ${isAlert ? "border-blood-bright rounded border p-0.5" : ""}`}
    >
      <Heart size={14} className={`mb-0.5 ${pulse ? "text-blood-bright" : "text-parchment-dim"}`} />
      <span className={`text-body-xs font-bold md:text-xs ${pulse ? "text-blood-bright" : ""}`}>
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
        <Trophy size={14} className="text-tarnished-gold-dim mb-0.5" />
        <span className="text-body-xs font-bold md:text-xs">{trophy.value}</span>
      </div>
      <div
        className={`flex flex-col items-center ${resErr === "blood" ? "border-blood-bright animate-pulse rounded border p-0.5" : ""}`}
      >
        <Droplet size={14} className="text-blood-bright mb-0.5" />
        <span className="text-blood-bright text-body-xs font-bold md:text-xs">{blood.value}</span>
      </div>
    </div>
  );
}

export function ShopHeader() {
  const isHelpActive = showHelpOverlay.value;
  const locked = shopLocked.value;
  const resErr = resourceError.value;
  return (
    <header className="border-iron/50 bg-void-surface flex shrink-0 items-center justify-between border-b p-2 md:p-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <span className="text-parchment-bright text-base font-bold tracking-wider md:text-lg">
            第{round.value}夜
          </span>
          <span className="text-parchment-dim md:text-body-xs text-card-md">
            {origin.value ? ORIGINS[origin.value]?.name : ""}
          </span>
        </div>
        <button
          onClick={toggleHelp}
          className={`cursor-pointer rounded p-1 transition-colors ${isHelpActive ? "text-blood-bright" : "text-iron-light hover:text-parchment-dim"}`}
          aria-label="ヘルプ"
        >
          <HelpCircle size={14} />
        </button>
      </div>
      <div className="flex items-center gap-4 md:gap-5">
        <ResourceBar resErr={resErr} />
        <div className="bg-iron h-5 w-px" />
        <button
          onClick={() => {
            playSE("select");
            showRetireConfirm.value = true;
          }}
          disabled={locked}
          className={`text-body-xs flex items-center gap-1 rounded border px-2 py-1 tracking-wider transition-colors md:text-xs ${
            locked
              ? "border-iron/30 text-disabled-fg cursor-not-allowed"
              : "border-iron text-parchment-dim hover:border-blood-deep hover:text-blood-bright cursor-pointer"
          }`}
        >
          <LogOut size={12} />
          逃走
        </button>
      </div>
    </header>
  );
}
