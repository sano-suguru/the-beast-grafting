import { ChevronRight, Trash2, Droplet, Undo2 } from "lucide-preact";
import type { OnboardingStep, UnitInstance } from "../types";
import {
  board,
  sanity,
  shopUnits,
  shopItems,
  selection,
  onboardingStep,
  undoSnapshot,
} from "../state/game-store";
import { executeSellUnit } from "../state/shop-actions";
import { undoLastAction } from "../state/undo-actions";
import { checkHighlight } from "../state/card-actions";
import { UnitCard } from "../components/unit-card";
import { ItemCard } from "../components/item-card";
import { FreezeButton } from "../components/freeze-button";
import { OnboardingTooltip } from "../components/onboarding-tooltip";
import { ShopHeader } from "./shop/shop-header";
import { ShopInfoPanel } from "./shop/shop-info-panel";
import { ShopFooter } from "./shop/shop-footer";

export function ShopScreen() {
  const sel = selection.value;
  const currentSanity = sanity.value;
  const currentBoard = board.value;
  const currentOnboarding = onboardingStep.value;

  return (
    <main className="relative mx-auto flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden border-x border-zinc-900 bg-zinc-950 font-serif text-zinc-300 select-none">
      <OnboardingOverlays step={currentOnboarding} />
      <ShopHeader />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto p-2 pb-0 md:p-4">
        <ShopInfoPanel sel={sel} currentSanity={currentSanity} />
        <BoardSection board={currentBoard} />
        <div className="mb-4 flex shrink-0 gap-2">
          <SellButton isActive={sel?.type === "BOARD_UNIT"} />
          <UndoButton />
        </div>
        <ShopSection />
      </div>

      <ShopFooter currentOnboarding={currentOnboarding} />
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

function BoardSection({ board: b }: { board: (UnitInstance | null)[] }) {
  return (
    <section aria-label="解剖台" className="mb-3 shrink-0">
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
      onClick={executeSellUnit}
      disabled={!isActive}
      className={`flex h-10 flex-1 shrink-0 items-center justify-center rounded border transition-all md:h-12 ${
        isActive
          ? "cursor-pointer border-red-800 bg-red-950/80 text-red-500 shadow-[0_0_15px_rgba(153,27,27,0.3)] active:scale-95"
          : "cursor-not-allowed border-zinc-800/50 bg-zinc-900/30 text-zinc-700 opacity-50"
      }`}
    >
      <Trash2 size={16} className="mr-2" />
      <span className="text-[10px] font-bold tracking-widest md:text-xs">
        選択した死体を解体する (鮮血還元)
      </span>
    </button>
  );
}

function UndoButton() {
  const hasSnapshot = undoSnapshot.value !== null;
  return (
    <button
      onClick={undoLastAction}
      disabled={!hasSnapshot}
      className={`flex h-10 shrink-0 items-center justify-center rounded border px-3 transition-all md:h-12 md:px-4 ${
        hasSnapshot
          ? "cursor-pointer border-zinc-600 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:scale-95"
          : "cursor-not-allowed border-zinc-800/50 bg-zinc-900/30 text-zinc-700 opacity-50"
      }`}
    >
      <Undo2 size={14} className="mr-1" />
      <span className="text-[10px] font-bold md:text-xs">元に戻す</span>
    </button>
  );
}

function ShopSection() {
  return (
    <section aria-label="闇市場" className="relative z-0 flex min-h-0 flex-1 flex-col pb-4">
      <span className="relative z-10 mb-1 block flex items-center gap-1 px-1 text-xs font-bold text-zinc-400 md:mb-2 md:text-sm">
        闇市場{" "}
        <span className="text-[10px] font-normal text-zinc-500">
          (素体・薬 一律 3<Droplet size={10} className="inline text-red-800" />)
        </span>
      </span>
      <div className="relative z-0 flex flex-1 items-start gap-2 md:gap-4">
        <ul role="list" className="flex min-w-0 flex-1 gap-1 md:gap-2">
          {shopUnits.value.map((item, i) => (
            <li key={`shop-u-${i}`} className="relative flex min-w-0 flex-1">
              <UnitCard
                unit={item?.unit ?? null}
                type="SHOP_UNIT"
                index={i}
                isHighlight={
                  checkHighlight("SHOP_UNIT", i, item?.unit ?? null) ||
                  (onboardingStep.value === "buy" && !!item ? "move" : false)
                }
              />
              {!!item && <FreezeButton isUnit={true} index={i} isFrozen={item.frozen} />}
            </li>
          ))}
        </ul>
        <div className="z-10 mx-0.5 h-24 w-px shrink-0 bg-zinc-800 md:mx-1" aria-hidden="true" />
        <ul role="list" className="z-10 flex shrink-0 gap-1 md:gap-2">
          {shopItems.value.map((item, i) => (
            <li key={`shop-i-${i}`} className="relative flex shrink-0">
              <ItemCard item={item?.item ?? null} index={i} />
              {!!item && (
                <FreezeButton isUnit={false} index={i} isFrozen={item.frozen} iconSize={10} />
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
