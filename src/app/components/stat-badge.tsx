import type { ComponentType } from "preact";
import type { LucideProps } from "lucide-preact";

interface StatBadgeProps {
  icon: ComponentType<LucideProps>;
  value: number;
  className?: string;
  /** base値との差分（正=バフ、負=デバフ）。永続的に色を変える */
  baseDiff?: number | undefined;
  /** フレーム間の差分（正=増加、負=減少）。パルスアニメ用 */
  frameDelta?: number | undefined;
  frameIdx?: number | undefined;
}

export function StatBadge({
  icon: Icon,
  value,
  className,
  baseDiff,
  frameDelta,
  frameIdx,
}: StatBadgeProps) {
  const persistColor =
    baseDiff != null && baseDiff > 0
      ? "text-emerald-400"
      : baseDiff != null && baseDiff < 0
        ? "text-red-400"
        : "";
  const flashClass =
    frameDelta != null && frameDelta > 0
      ? "animate-stat-up"
      : frameDelta != null && frameDelta < 0
        ? "animate-stat-down"
        : "";
  const color = persistColor || className || "";

  return (
    <div className="flex items-center gap-0.5 font-bold">
      <Icon size={12} className={color} />
      <span
        key={frameDelta != null && frameDelta !== 0 ? `s-${frameIdx}` : undefined}
        className={`text-[10px] md:text-xs ${color} ${flashClass}`}
      >
        {value}
      </span>
    </div>
  );
}
