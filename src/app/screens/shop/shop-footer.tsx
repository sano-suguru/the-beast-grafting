import { RefreshCw, Play } from "lucide-preact";
import type { OnboardingStep } from "../../types";
import { blood, origin, freeRoll, cultistUsed, sanity, board } from "../../state/game-store";
import { rollShop, useCultistAbility } from "../../state/shop-actions";
import { startPreBattle } from "../../state/battle-actions";

function isRollDisabled(hasFreeRoll: boolean, currentBlood: number, step: OnboardingStep): boolean {
  return (!hasFreeRoll && currentBlood < 1) || step === "buy" || step === "graft";
}

function isBattleDisabled(hasUnit: boolean, step: OnboardingStep): boolean {
  return !hasUnit || step === "buy" || step === "graft" || step === "roll";
}

function getRollButtonClass(
  hasFreeRoll: boolean,
  currentBlood: number,
  step: OnboardingStep,
): string {
  const canRoll = hasFreeRoll || currentBlood >= 1;
  const base = canRoll
    ? "border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 active:scale-95"
    : "border-zinc-900 bg-zinc-950 text-zinc-700 opacity-50 cursor-not-allowed";
  const onboarding =
    step === "roll"
      ? "animate-pulse border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
      : "";
  return `flex-1 flex items-center justify-center gap-1 border rounded py-2 text-[10px] md:text-xs font-bold transition-colors cursor-pointer ${base} ${onboarding}`;
}

function getBattleButtonClass(hasUnit: boolean, step: OnboardingStep): string {
  const base = !hasUnit
    ? "border-zinc-900 bg-zinc-950 text-zinc-700 opacity-50 cursor-not-allowed"
    : "border-red-900 bg-red-950/20 text-red-500 hover:bg-red-950/40 active:scale-95";
  const onboarding =
    step === "battle"
      ? "animate-pulse border-red-500 text-red-100 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
      : "";
  return `flex items-center justify-center gap-1 border rounded py-2 text-[10px] md:text-xs font-bold tracking-widest transition-all cursor-pointer ${base} ${onboarding}`;
}

export function ShopFooter({ currentOnboarding }: { currentOnboarding: OnboardingStep }) {
  const currentFreeRoll = freeRoll.value;
  const currentBlood = blood.value;
  const currentBoard = board.value;
  const hasUnit = currentBoard.some((u) => u);
  const rollDisabled = isRollDisabled(currentFreeRoll, currentBlood, currentOnboarding);
  const battleDisabled = isBattleDisabled(hasUnit, currentOnboarding);

  return (
    <footer className="relative z-20 grid shrink-0 grid-cols-2 gap-2 border-t border-zinc-800 bg-zinc-900 p-2 md:p-3">
      <div className="flex gap-1 md:gap-2">
        <button
          onClick={rollShop}
          disabled={rollDisabled}
          className={getRollButtonClass(currentFreeRoll, currentBlood, currentOnboarding)}
        >
          <RefreshCw size={14} /> 墓暴き ({currentFreeRoll ? "無料" : "1"})
        </button>
        {origin.value === "cultist" && !cultistUsed.value && sanity.value > 1 && (
          <button
            onClick={useCultistAbility}
            className="cursor-pointer rounded border border-red-900 bg-red-950/30 px-2 text-[10px] text-red-600 hover:bg-red-900/50 active:scale-95"
          >
            血の代償
          </button>
        )}
      </div>
      <button
        onClick={startPreBattle}
        disabled={battleDisabled}
        className={getBattleButtonClass(hasUnit, currentOnboarding)}
      >
        狂宴へ向かう <Play size={14} />
      </button>
    </footer>
  );
}
