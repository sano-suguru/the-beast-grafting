import { ChevronRight, Trash2, Undo2 } from "lucide-preact";
import { ResourceText } from "../components/resource-text";
import { useDelayedFlag } from "../hooks/use-delayed-flag";
import type { OnboardingStep, UnitInstance } from "../types";
import {
  board,
  life,
  selection,
  onboardingStep,
  canUndo,
  showHelpOverlay,
  shopLocked,
  shopActionError,
  showRetireConfirm,
  recoveryWarning,
  hoveredItem,
} from "../state/game-store";
import { executeSellUnit } from "../state/shop-actions";
import { undoLastAction } from "../state/undo-actions";
import { checkHighlight } from "../state/card-actions";
import { UnitCard } from "../components/unit-card";
import { OnboardingTooltip } from "../components/onboarding-tooltip";
import { ShopHeader } from "./shop/shop-header";
import { ShopInfoPanel } from "./shop/shop-info-panel";
import { ShopFooter } from "./shop/shop-footer";
import { ShopSection } from "./shop/shop-section";
import {
  ShopBusyOverlay,
  RetireConfirmOverlay,
  ShopErrorBanner,
  RecoveryWarningBanner,
} from "./shop/shop-overlays";
import { playSEFrom } from "../engine/audio";

export function ShopScreen() {
  const sel = selection.value;
  const currentLife = life.value;
  const currentBoard = board.value;
  const currentOnboarding = onboardingStep.value;
  const busy = shopLocked.value;
  const actionError = shopActionError.value;
  const showBusyOverlay = useDelayedFlag(busy);

  return (
    <main
      className="relative mx-auto flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden border-x border-zinc-900 font-serif text-zinc-300 select-none"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(39,39,42,0.4) 0%, transparent 60%), #09090b",
      }}
    >
      {!showHelpOverlay.value && <OnboardingOverlays step={currentOnboarding} />}
      {showHelpOverlay.value && <HelpBackdrop />}
      <ShopHeader />

      <div className="relative flex min-h-0 flex-1 flex-col p-2 pb-0 md:p-4">
        <ShopInfoPanel sel={sel} hover={hoveredItem.value} currentLife={currentLife} />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-2 md:pt-3">
          <BoardSection board={currentBoard} />
          <div className="mb-4 flex shrink-0 gap-2">
            <SellButton isActive={sel?.type === "BOARD_UNIT" && !busy} />
            <UndoButton disabled={busy} />
          </div>
          <ShopSection />
        </div>
      </div>

      <ShopFooter currentOnboarding={currentOnboarding} />
      {showBusyOverlay.value && <ShopBusyOverlay />}
      {showRetireConfirm.value && <RetireConfirmOverlay />}
      {actionError && !showRetireConfirm.value && <ShopErrorBanner />}
      {recoveryWarning.value && <RecoveryWarningBanner />}
    </main>
  );
}

function OnboardingOverlays({ step }: { step: OnboardingStep }) {
  return (
    <>
      {step === "buy" && (
        <OnboardingTooltip
          text="闇市場の素体をタップして選択し、解剖台に並べろ。生きる盾が必要だ。"
          positionClass="top-[380px] md:top-[420px] left-1/2 -translate-x-1/2"
        />
      )}
      {step === "graft" && (
        <OnboardingTooltip
          text="同じ素体を買い、解剖台のキメラに重ねろ。肉と肉が縫い合わさり、より強大となる。"
          positionClass="top-[200px] md:top-[220px] left-1/2 -translate-x-1/2"
        />
      )}
      {step === "roll" && (
        <OnboardingTooltip
          text="血が余っているなら「墓暴き」で新たな死体を探せ。血は翌夜には腐って消滅する。"
          positionClass="bottom-[75px] left-1/4 -translate-x-1/2"
        />
      )}
      {step === "battle" && (
        <OnboardingTooltip
          text="準備は整った。血を使い切ったら「狂宴へ向かう」ボタンを押せ。奴らが来る。"
          positionClass="bottom-[75px] left-3/4 -translate-x-1/2"
        />
      )}
    </>
  );
}

function HelpBackdrop() {
  return (
    <div
      className="absolute inset-0 z-40 bg-black/60"
      onClick={() => {
        showHelpOverlay.value = false;
      }}
    />
  );
}

function BoardSection({ board: b }: { board: (UnitInstance | null)[] }) {
  return (
    <section aria-label="解剖台" className="relative mb-3 shrink-0">
      {showHelpOverlay.value && (
        <OnboardingTooltip
          text="同じ素体を重ねると強くなる"
          positionClass="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        />
      )}
      <div className="mb-1 flex items-end justify-between px-1 md:mb-2">
        <span className="text-xs font-bold text-zinc-400 md:text-sm">解剖台</span>
        <span className="flex items-center gap-1 text-[10px] font-normal text-zinc-600">
          後衛 <ChevronRight size={10} className="inline text-zinc-500" /> 前衛
        </span>
      </div>
      <ul
        role="list"
        className="flex w-full justify-between gap-1 rounded border border-zinc-900 bg-zinc-900/20 p-1 md:gap-2 md:p-2"
      >
        {b.map((u, i) => (
          <li key={`board-${i}`} className="flex min-w-0 flex-1">
            <UnitCard
              unit={u}
              type="BOARD_SLOT"
              index={i}
              isHighlight={checkHighlight("BOARD_SLOT", i, u)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SellButton({ isActive }: { isActive: boolean }) {
  return (
    <button
      onClick={() => {
        playSEFrom(executeSellUnit());
      }}
      disabled={!isActive}
      className={`flex h-10 flex-1 shrink-0 items-center justify-center rounded border transition-all md:h-12 ${
        isActive
          ? "cursor-pointer border-red-800 bg-red-950/80 text-red-500 shadow-[0_0_15px_rgba(153,27,27,0.3)] active:scale-95"
          : "cursor-not-allowed border-zinc-800/50 bg-zinc-900/30 text-zinc-700 opacity-50"
      }`}
    >
      <Trash2 size={16} className="mr-2" />
      <span className="text-[10px] font-bold tracking-widest md:text-xs">
        <ResourceText text="選択した死体を解体する ({blood}還元)" />
      </span>
    </button>
  );
}

function UndoButton({ disabled }: { disabled: boolean }) {
  const enabled = canUndo.value && !disabled;
  return (
    <button
      onClick={() => {
        playSEFrom(undoLastAction());
      }}
      disabled={!enabled}
      className={`flex h-10 shrink-0 items-center justify-center rounded border px-3 transition-all md:h-12 md:px-4 ${
        enabled
          ? "cursor-pointer border-zinc-600 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:scale-95"
          : "cursor-not-allowed border-zinc-800/50 bg-zinc-900/30 text-zinc-700 opacity-50"
      }`}
    >
      <Undo2 size={14} className="mr-1" />
      <span className="text-[10px] font-bold md:text-xs">元に戻す</span>
    </button>
  );
}
