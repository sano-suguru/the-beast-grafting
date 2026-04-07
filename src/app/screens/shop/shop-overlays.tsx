import { useEffect } from "preact/hooks";
import { X } from "lucide-preact";
import {
  shopActionError,
  showRetireConfirm,
  retiring,
  recoveryWarning,
} from "../../state/game-store";
import { retireGame } from "../../state/game-actions";
import { playSE } from "../../engine/audio";

export function ShopBusyOverlay() {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
      <p className="animate-pulse text-sm tracking-widest text-red-800">……暗闇の中で蠢いている……</p>
    </div>
  );
}

export function RetireConfirmOverlay() {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="mx-4 flex max-w-sm flex-col items-center gap-6 border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-center text-sm leading-relaxed text-zinc-300">
          この地下室を捨てて逃げますか？
          <br />
          <span className="text-xs text-zinc-500">進行状況は失われます。</span>
        </p>
        {shopActionError.value && (
          <p className="text-center text-xs text-red-400">
            接続に失敗しました。再度お試しください。
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => {
              shopActionError.value = null;
              showRetireConfirm.value = false;
            }}
            disabled={retiring.value}
            className={`border border-zinc-700 px-4 py-2 text-xs tracking-widest transition-all ${
              retiring.value
                ? "cursor-wait text-zinc-700"
                : "cursor-pointer text-zinc-400 hover:bg-zinc-900 active:scale-95"
            }`}
          >
            留まる
          </button>
          <button
            onClick={() => {
              playSE("select");
              void retireGame();
            }}
            disabled={retiring.value}
            className={`border border-red-900 px-4 py-2 text-xs tracking-widest transition-all ${
              retiring.value
                ? "animate-pulse cursor-wait bg-red-950/10 text-red-900"
                : "cursor-pointer bg-red-950/30 text-red-500 hover:bg-red-950/50 active:scale-95"
            }`}
          >
            {retiring.value ? "……" : "逃げ出す"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ShopErrorBanner() {
  return (
    <div className="absolute inset-x-0 top-0 z-50 flex items-center justify-between bg-red-950/90 px-3 py-2 text-xs text-red-400">
      <span>接続に失敗しました。再度お試しください。</span>
      <button
        onClick={() => {
          shopActionError.value = null;
        }}
        className="ml-2 shrink-0 cursor-pointer text-red-600 hover:text-red-400"
      >
        <X size={14} />
      </button>
    </div>
  );
}

const RECOVERY_BANNER_MS = 8000;

export function RecoveryWarningBanner() {
  useEffect(() => {
    const id = setTimeout(() => {
      recoveryWarning.value = null;
    }, RECOVERY_BANNER_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="absolute inset-x-0 top-0 z-50 flex items-center justify-between bg-amber-950/90 px-3 py-2 text-xs text-amber-400">
      <span>{recoveryWarning.value}</span>
      <button
        onClick={() => {
          recoveryWarning.value = null;
        }}
        className="ml-2 shrink-0 cursor-pointer text-amber-600 hover:text-amber-400"
      >
        <X size={14} />
      </button>
    </div>
  );
}
