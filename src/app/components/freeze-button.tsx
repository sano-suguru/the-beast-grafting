import { Lock, LockOpen } from "lucide-preact";
import { handleFreezeClick } from "../state/shop-actions";
import { initAudio, playSEFrom } from "../engine/audio";

interface FreezeButtonProps {
  slotType: "unit" | "item" | "reward";
  index: number;
  isFrozen?: boolean | undefined;
  iconSize?: number | undefined;
}

export function FreezeButton({ slotType, index, isFrozen, iconSize = 12 }: FreezeButtonProps) {
  const onClick = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    initAudio();
    playSEFrom(handleFreezeClick(slotType, index, !isFrozen));
  };
  return (
    <button
      role="switch"
      onPointerDown={(e: Event) => e.stopPropagation()}
      onClick={onClick}
      aria-label="防腐処理"
      aria-checked={!!isFrozen}
      className={`hover:bg-iron absolute -top-2 -right-2 z-20 rounded-full border p-1 shadow-md ${isFrozen ? "border-tarnished-gold-dim bg-tarnished-gold-deep" : "border-iron bg-void-surface"}`}
    >
      {isFrozen ? (
        <Lock size={iconSize} className="text-tarnished-gold" />
      ) : (
        <LockOpen size={iconSize} className="text-iron-light" />
      )}
    </button>
  );
}
