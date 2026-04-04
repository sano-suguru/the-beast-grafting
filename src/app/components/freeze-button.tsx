import { Lock, LockOpen } from "lucide-preact";
import { handleFreezeClick } from "../state/shop-actions";

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
    handleFreezeClick(slotType, index, !isFrozen);
  };
  return (
    <button
      role="switch"
      onPointerDown={(e: Event) => e.stopPropagation()}
      onClick={onClick}
      aria-label="防腐処理"
      aria-checked={!!isFrozen}
      className={`absolute -top-2 -right-2 z-20 rounded-full border p-1 shadow-md hover:bg-zinc-700 ${isFrozen ? "border-amber-800 bg-amber-950" : "border-zinc-600 bg-zinc-800"}`}
    >
      {isFrozen ? (
        <Lock size={iconSize} className="text-amber-400" />
      ) : (
        <LockOpen size={iconSize} className="text-zinc-400" />
      )}
    </button>
  );
}
