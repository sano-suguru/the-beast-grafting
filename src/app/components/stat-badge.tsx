import type { ComponentType } from "preact";
import type { LucideProps } from "lucide-preact";

interface StatBadgeProps {
  icon?: ComponentType<LucideProps>;
  value: number;
  className?: string;
  /** "atk" → amber, "hp" → rose。className より優先、baseDiff より劣後 */
  statType?: "atk" | "hp";
  /** true で敵側の抑えめトーンを使う */
  muted?: boolean;
  /** base値との差分（正=バフ、負=デバフ）。永続的に色を変える */
  baseDiff?: number | undefined;
  /** フレーム間の差分（正=増加、負=減少）。パルスアニメ用 */
  frameDelta?: number | undefined;
  frameIdx?: number | undefined;
}

const STAT_COLORS: Record<string, Record<string, string>> = {
  atk: { default: "text-tarnished-gold", muted: "text-tarnished-gold-dim/70" },
  hp: { default: "text-blood-bright", muted: "text-blood-dim/70" },
};

function getPersistColor(baseDiff: number | undefined): string {
  if (baseDiff == null) return "";
  if (baseDiff > 0) return "text-tarnished-gold";
  if (baseDiff < 0) return "text-blood-bright";
  return "";
}

function getFlashClass(frameDelta: number | undefined): string {
  if (frameDelta == null) return "";
  if (frameDelta > 0) return "animate-stat-up";
  if (frameDelta < 0) return "animate-stat-down";
  return "";
}

function resolveColor(
  baseDiff: number | undefined,
  statType: "atk" | "hp" | undefined,
  muted: boolean | undefined,
  className: string | undefined,
): string {
  const persist = getPersistColor(baseDiff);
  if (persist) return persist;
  if (statType) return STAT_COLORS[statType]?.[muted ? "muted" : "default"] ?? "";
  return className ?? "";
}

export function StatBadge({
  icon: Icon,
  value,
  className,
  statType,
  muted,
  baseDiff,
  frameDelta,
  frameIdx,
}: StatBadgeProps) {
  const color = resolveColor(baseDiff, statType, muted, className);
  const flashClass = getFlashClass(frameDelta);
  const spanKey = frameDelta != null && frameDelta !== 0 ? `s-${frameIdx}` : undefined;

  return (
    <div className={`flex items-center font-bold ${Icon ? "gap-0.5" : ""}`}>
      {Icon != null && <Icon size={12} className={color} aria-hidden="true" />}
      <span key={spanKey} className={`text-[11px] md:text-xs ${color} ${flashClass}`}>
        {value}
      </span>
    </div>
  );
}
