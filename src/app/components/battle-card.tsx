import { Skull, Swords, Shield } from "lucide-preact";
import { StatBadge } from "./stat-badge";
import { EquipIcon } from "./equip-icon";
import type { BattleUnitSnapshot, BattleAction } from "../types";

interface BattleCardProps {
  unit: BattleUnitSnapshot | null;
  side: "p" | "e";
  actionObj?: BattleAction | undefined;
  fastForward?: boolean | undefined;
  frameIdx?: number | undefined;
  /** ATK の base との差分（永続色用） */
  atkBaseDiff?: number;
  /** HP の base との差分（永続色用） */
  hpBaseDiff?: number;
  /** ATK のフレーム間差分（パルスアニメ用） */
  atkDelta?: number;
  /** HP のフレーム間差分（パルスアニメ用） */
  hpDelta?: number;
}

const ACTION_STYLES: Record<string, { transform: string; anim: string }> = {
  damage: {
    transform: "scale-95 z-20",
    anim: "bg-red-950/90 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.7)]",
  },
  buff: {
    transform: "scale-105 z-20",
    anim: "bg-emerald-950/90 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.7)]",
  },
  heal: {
    transform: "scale-105 z-20",
    anim: "bg-emerald-950/90 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.7)]",
  },
  skill: {
    transform: "-translate-y-4 scale-105 z-30",
    anim: "bg-amber-950/90 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.7)]",
  },
  defend: {
    transform: "scale-95 z-20",
    anim: "bg-zinc-700 border-zinc-300 shadow-[0_0_20px_rgba(161,161,170,0.7)]",
  },
  summon: {
    transform: "scale-110 z-20",
    anim: "bg-violet-950/90 border-violet-400 shadow-[0_0_30px_rgba(139,92,246,0.8)]",
  },
  death: {
    transform: "scale-90 z-0",
    anim: "bg-zinc-950 border-red-900/60 shadow-[0_0_15px_rgba(220,38,38,0.4)]",
  },
};

function getStyles(actionType: string | undefined, side: "p" | "e") {
  if (actionType === "clash") {
    const dir =
      side === "p" ? "translate-x-4 md:translate-x-8" : "-translate-x-4 md:-translate-x-8";
    return {
      transform: `${dir} z-30 scale-105`,
      anim: "bg-zinc-800 border-zinc-400 shadow-[0_0_20px_rgba(255,255,255,0.4)]",
    };
  }
  if (actionType && ACTION_STYLES[actionType]) return ACTION_STYLES[actionType];
  const defaultAnim =
    side === "p"
      ? "bg-zinc-900 border-zinc-700 shadow-[0_0_10px_rgba(255,255,255,0.02)]"
      : "bg-zinc-900 border-red-900/50 shadow-[0_0_10px_rgba(220,38,38,0.02)]";
  return { transform: "z-10", anim: defaultAnim };
}

const FLOAT_COLORS: Record<string, string> = {
  damage: "text-red-500",
  defend: "text-zinc-400",
  summon: "text-violet-400",
};

function FloatingText({
  text,
  actionType,
  frameIdx,
}: {
  text: string;
  actionType?: string | undefined;
  frameIdx?: number | undefined;
}) {
  return (
    <div
      key={`float-${frameIdx}`}
      className="animate-float-up pointer-events-none absolute -top-6 left-1/2 z-50 text-sm font-black whitespace-nowrap drop-shadow-md md:text-base"
      style={{ textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}
    >
      <span className={FLOAT_COLORS[actionType || ""] || "text-emerald-400"}>{text}</span>
    </div>
  );
}

const EXTRA_ANIM: Record<string, string> = {
  death: "animate-death",
  summon: "animate-summon",
  skill: "animate-skill",
};

function getExtraAnim(actionType: string | undefined): string {
  return (actionType && EXTRA_ANIM[actionType]) || "";
}

function getNameColor(side: string): string {
  return side === "p" ? "text-zinc-300" : "text-red-300/80";
}

function getSkullColor(side: string): string {
  return side === "p" ? "text-zinc-600" : "text-red-900/60";
}

function BattleCardStats({
  unit,
  side,
  atkBaseDiff,
  hpBaseDiff,
  atkDelta,
  hpDelta,
  frameIdx,
}: {
  unit: BattleUnitSnapshot;
  side: "p" | "e";
  atkBaseDiff?: number | undefined;
  hpBaseDiff?: number | undefined;
  atkDelta?: number | undefined;
  hpDelta?: number | undefined;
  frameIdx?: number | undefined;
}) {
  const muted = side === "e";
  return (
    <div className="relative z-10 flex items-center justify-between rounded bg-zinc-950 px-1">
      <StatBadge
        icon={Swords}
        value={unit.atk}
        statType="atk"
        muted={muted}
        baseDiff={atkBaseDiff}
        frameDelta={atkDelta}
        frameIdx={frameIdx}
      />
      <StatBadge
        icon={Shield}
        value={unit.hp}
        statType="hp"
        muted={muted}
        baseDiff={hpBaseDiff}
        frameDelta={hpDelta}
        frameIdx={frameIdx}
      />
    </div>
  );
}

function BattleCardBody({
  unit,
  side,
  actionObj,
  frameIdx,
}: {
  unit: BattleUnitSnapshot;
  side: "p" | "e";
  actionObj?: BattleAction | undefined;
  frameIdx?: number | undefined;
}) {
  const actionType = actionObj?.type;
  const nameColor = unit.isChurch ? "text-amber-200" : getNameColor(side);
  const skullColor = unit.isChurch ? "text-amber-700/50" : getSkullColor(side);
  return (
    <>
      {actionType === "damage" && (
        <div
          key={`flash-${frameIdx}`}
          className="animate-hit-flash pointer-events-none absolute inset-0 rounded-md bg-white"
        />
      )}
      {actionObj?.value && (
        <FloatingText text={actionObj.value} actionType={actionType} frameIdx={frameIdx} />
      )}
      <div
        className={`mt-0.5 line-clamp-2 h-6 overflow-hidden text-center text-[8px] leading-tight font-bold break-words md:mt-1 md:h-8 md:text-[10px] ${nameColor}`}
      >
        {unit.name}
      </div>
      <div className="flex flex-1 items-center justify-center">
        {unit.equip && (
          <div className="absolute top-1 left-1">
            <EquipIcon equipId={unit.equip} />
          </div>
        )}
        <Skull size={18} className={skullColor} />
      </div>
    </>
  );
}

export function BattleCard({
  unit,
  side,
  actionObj,
  fastForward: ff,
  frameIdx,
  atkBaseDiff,
  hpBaseDiff,
  atkDelta,
  hpDelta,
}: BattleCardProps) {
  if (!unit) return null;
  const actionType = actionObj?.type;
  const { transform, anim } = getStyles(actionType, side);
  const extraAnim = getExtraAnim(actionType);

  return (
    <article
      style={{
        transitionDuration: ff ? "150ms" : "300ms",
        animationDuration: ff ? "0.12s" : undefined,
      }}
      data-uid={unit.uid}
      aria-label={unit.name}
      className={`relative flex aspect-[2/3] max-w-[72px] min-w-[50px] flex-1 flex-col rounded-md p-1 transition-all ease-out ${anim} ${transform} ${extraAnim}`}
    >
      <BattleCardBody unit={unit} side={side} actionObj={actionObj} frameIdx={frameIdx} />
      <BattleCardStats
        unit={unit}
        side={side}
        atkBaseDiff={atkBaseDiff}
        hpBaseDiff={hpBaseDiff}
        atkDelta={atkDelta}
        hpDelta={hpDelta}
        frameIdx={frameIdx}
      />
    </article>
  );
}
