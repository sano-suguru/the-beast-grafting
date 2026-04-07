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
      <p className="text-blood-deep animate-pulse text-sm tracking-widest">
        ……暗闇の中で蠢いている……
      </p>
    </div>
  );
}

export function RetireConfirmOverlay() {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="border-iron bg-void mx-4 flex max-w-sm flex-col items-center gap-6 border p-6">
        <p className="text-parchment-bright text-center text-sm leading-relaxed">
          この地下室を捨てて逃げますか？
          <br />
          <span className="text-parchment-dim text-xs">進行状況は失われます。</span>
        </p>
        {shopActionError.value && (
          <p className="text-blood-bright text-center text-xs">
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
            className={`border-iron border px-4 py-2 text-xs tracking-widest transition-all ${
              retiring.value
                ? "text-iron-light cursor-wait"
                : "text-parchment-dim hover:bg-void-surface cursor-pointer active:scale-95"
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
            className={`border-blood-deep border px-4 py-2 text-xs tracking-widest transition-all ${
              retiring.value
                ? "bg-blood-deep/10 text-blood-deep animate-pulse cursor-wait"
                : "bg-blood-deep/30 text-blood-bright hover:bg-blood-deep/50 cursor-pointer active:scale-95"
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
    <div className="bg-blood-deep/90 text-blood-bright absolute inset-x-0 top-0 z-50 flex items-center justify-between px-3 py-2 text-xs">
      <span>接続に失敗しました。再度お試しください。</span>
      <button
        onClick={() => {
          shopActionError.value = null;
        }}
        className="text-blood-bright hover:text-parchment ml-2 shrink-0 cursor-pointer"
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
    <div className="text-tarnished-gold bg-tarnished-gold-deep/90 absolute inset-x-0 top-0 z-50 flex items-center justify-between px-3 py-2 text-xs">
      <span>{recoveryWarning.value}</span>
      <button
        onClick={() => {
          recoveryWarning.value = null;
        }}
        className="text-tarnished-gold-dim hover:text-tarnished-gold ml-2 shrink-0 cursor-pointer"
      >
        <X size={14} />
      </button>
    </div>
  );
}
