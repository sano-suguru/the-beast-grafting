import { Swords, Shield } from "lucide-preact";
import { getUnitIcon } from "../data/unit-icons";
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
    anim: "bg-blood-deep/90 border-blood-bright shadow-glow-blood",
  },
  buff: {
    transform: "scale-105 z-20",
    anim: "bg-rot-deep/90 border-rot shadow-glow-rot",
  },
  heal: {
    transform: "scale-105 z-20",
    anim: "bg-rot-deep/90 border-rot shadow-glow-rot",
  },
  skill: {
    transform: "-translate-y-4 scale-105 z-30",
    anim: "bg-tarnished-gold-deep/90 border-tarnished-gold shadow-glow-gold",
  },
  defend: {
    transform: "scale-95 z-20",
    anim: "bg-iron border-iron-light shadow-glow-iron",
  },
  summon: {
    transform: "scale-110 z-20",
    anim: "bg-hex-deep/90 border-hex shadow-glow-hex",
  },
  death: {
    transform: "scale-90 z-0",
    anim: "bg-void border-blood-deep/60 shadow-glow-blood-sm",
  },
};

function getStyles(actionType: string | undefined, side: "p" | "e") {
  if (actionType === "clash") {
    const dir =
      side === "p" ? "translate-x-4 md:translate-x-8" : "-translate-x-4 md:-translate-x-8";
    return {
      transform: `${dir} z-30 scale-105`,
      anim: "bg-iron border-parchment-dim shadow-glow-parchment",
    };
  }
  if (actionType && ACTION_STYLES[actionType]) return ACTION_STYLES[actionType];
  const defaultAnim =
    side === "p"
      ? "bg-void-surface border-iron shadow-ambient-p"
      : "bg-void-surface border-blood-deep/50 shadow-ambient-e";
  return { transform: "z-10", anim: defaultAnim };
}

const FLOAT_COLORS: Record<string, string> = {
  damage: "text-blood-bright",
  buff: "text-rot",
  heal: "text-rot",
  defend: "text-iron-light",
  summon: "text-hex",
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
      <span className={FLOAT_COLORS[actionType || ""] || "text-tarnished-gold"}>{text}</span>
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
  return side === "p" ? "text-parchment-bright" : "text-blood-bright";
}

function getIconColor(side: string): string {
  return side === "p" ? "text-iron-light" : "text-blood-muted";
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
    <div className="border-iron/30 bg-void relative z-10 flex items-center justify-between rounded border-t px-1">
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
  const nameColor = unit.isChurch ? "text-church" : getNameColor(side);
  const iconColor = unit.isChurch ? "text-church-muted" : getIconColor(side);
  const Icon = getUnitIcon(unit.id);
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
        className={`md:text-card-md text-card-sm mt-0.5 line-clamp-2 h-6 overflow-hidden text-center leading-tight font-bold break-words md:mt-1 md:h-8 ${nameColor}`}
      >
        {unit.name}
      </div>
      <div className="flex flex-1 items-center justify-center">
        {unit.equip && (
          <div className="absolute top-1 left-1">
            <EquipIcon equipId={unit.equip} />
          </div>
        )}
        <Icon className={`size-4.5 md:size-7 ${iconColor}`} />
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
      className={`relative flex aspect-[2/3] max-w-[72px] min-w-[50px] flex-1 flex-col rounded-sm p-1 transition-all ease-out ${anim} ${transform} ${extraAnim}`}
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
