import { RefreshCw, Play } from "lucide-preact";
import { useDelayedFlag } from "../../hooks/use-delayed-flag";
import type { OnboardingStep } from "../../types";
import {
  blood,
  origin,
  freeRoll,
  cultistUsed,
  life,
  board,
  activeEvent,
  showHelpOverlay,
  shopLocked,
} from "../../state/game-store";
import { OnboardingTooltip } from "../../components/onboarding-tooltip";
import { CULTIST_LIFE_COST } from "../../../shared/constants";
import { rollShop, useCultistAbility } from "../../state/shop-actions";
import { startPreBattle } from "../../state/battle-actions";
import { initAudio, playSE, playSEFrom } from "../../engine/audio";

function isRollDisabled(hasFreeRoll: boolean, currentBlood: number, step: OnboardingStep): boolean {
  if (activeEvent.value?.lockRoll) return true;
  return (!hasFreeRoll && currentBlood < 1) || step === "buy" || step === "graft";
}

function isBattleDisabled(hasUnit: boolean, step: OnboardingStep): boolean {
  return !hasUnit || step === "buy" || step === "graft" || step === "roll";
}

function getRollButtonClass(
  hasFreeRoll: boolean,
  currentBlood: number,
  step: OnboardingStep,
  rollLocked: boolean,
): string {
  const canRoll = !rollLocked && (hasFreeRoll || currentBlood >= 1);
  const base = canRoll
    ? "border-iron bg-iron/60 hover:bg-iron text-parchment-bright active:scale-95"
    : "border-iron/30 bg-void text-disabled-fg cursor-not-allowed";
  const onboarding =
    step === "roll" ? "animate-pulse border-tarnished-gold shadow-glow-gold-pulse" : "";
  return `flex-1 flex items-center justify-center gap-1 border rounded py-2 text-body-xs md:text-xs font-bold transition-colors cursor-pointer ${base} ${onboarding}`;
}

function getBattleButtonClass(hasUnit: boolean, step: OnboardingStep): string {
  const base = !hasUnit
    ? "border-iron/30 bg-void text-disabled-fg cursor-not-allowed"
    : "border-blood-deep bg-blood-deep/20 text-blood-bright hover:bg-blood-deep/40 active:scale-95";
  const onboarding =
    step === "battle"
      ? "animate-pulse border-blood-bright text-parchment shadow-glow-blood-pulse"
      : "";
  return `flex items-center justify-center gap-1 border rounded py-2 text-body-xs md:text-xs font-bold tracking-widest transition-all cursor-pointer ${base} ${onboarding}`;
}

function RollSection({
  currentOnboarding,
  busy,
}: {
  currentOnboarding: OnboardingStep;
  busy: boolean;
}) {
  const currentFreeRoll = freeRoll.value;
  const currentBlood = blood.value;
  const rollDisabled = isRollDisabled(currentFreeRoll, currentBlood, currentOnboarding) || busy;
  return (
    <div className="relative flex gap-1 md:gap-2">
      {showHelpOverlay.value && (
        <OnboardingTooltip
          text="品揃えを入れ替える"
          positionClass="bottom-full left-1/2 -translate-x-1/2 mb-2"
        />
      )}
      <button
        onClick={() => {
          initAudio();
          playSEFrom(rollShop());
        }}
        disabled={rollDisabled}
        className={getRollButtonClass(
          currentFreeRoll,
          currentBlood,
          currentOnboarding,
          !!activeEvent.value?.lockRoll,
        )}
      >
        <RefreshCw size={14} /> 墓暴き ({currentFreeRoll ? "無料" : "1"})
      </button>
      {origin.value === "cultist" && !cultistUsed.value && life.value > CULTIST_LIFE_COST && (
        <button
          onClick={() => {
            initAudio();
            playSEFrom(useCultistAbility());
          }}
          disabled={busy}
          className="border-blood-deep bg-blood-deep/30 text-blood-bright hover:bg-blood-deep/50 disabled:text-disabled-fg disabled:border-iron/30 text-body-xs cursor-pointer rounded border px-2 active:scale-95 disabled:cursor-not-allowed"
        >
          血の代償
        </button>
      )}
    </div>
  );
}

export function ShopFooter({ currentOnboarding }: { currentOnboarding: OnboardingStep }) {
  const busy = shopLocked.value;
  const showBusyText = useDelayedFlag(busy);
  const hasUnit = board.value.some((u) => u);
  const battleDisabled = isBattleDisabled(hasUnit, currentOnboarding) || busy;

  return (
    <footer className="border-iron/50 bg-void-surface relative z-20 grid shrink-0 grid-cols-2 gap-2 border-t p-2 md:p-3">
      <RollSection currentOnboarding={currentOnboarding} busy={busy} />
      <div className="relative flex">
        {showHelpOverlay.value && (
          <OnboardingTooltip
            text="準備ができたら狂宴へ"
            positionClass="bottom-full left-1/2 -translate-x-1/2 mb-2"
          />
        )}
        <button
          onClick={() => {
            initAudio();
            playSE("clash");
            startPreBattle();
          }}
          disabled={battleDisabled}
          className={`flex-1 ${getBattleButtonClass(hasUnit, currentOnboarding)}`}
        >
          {showBusyText.value ? (
            <span className="animate-pulse">……準備中……</span>
          ) : (
            <>
              狂宴へ向かう <Play size={14} />
            </>
          )}
        </button>
      </div>
    </footer>
  );
}
