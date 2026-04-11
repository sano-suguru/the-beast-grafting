import { useMemo } from "preact/hooks";
import { Swords } from "lucide-preact";
import type { BattleFrame, BattleUnitSnapshot } from "../../types";
import { currentEnemyTeam } from "../../state/game-store";
import { invariant } from "../../../shared/invariant";
import { GradientBackground } from "../../components/gradient-background";
import { BattleCard } from "../../components/battle-card";
import { ParticleCanvas } from "../../components/particle-canvas";

interface BattleVisualizerProps {
  currentFrame: BattleFrame;
  prevFrame: BattleFrame | undefined;
  ff: boolean;
  frameIdx: number;
}

function buildPrevStats(frame: BattleFrame | undefined): Map<string, { atk: number; hp: number }> {
  const map = new Map<string, { atk: number; hp: number }>();
  if (!frame) return map;
  for (const u of frame.pBoard) map.set(u.uid, { atk: u.atk, hp: u.hp });
  for (const u of frame.eBoard) map.set(u.uid, { atk: u.atk, hp: u.hp });
  return map;
}

function renderCard(
  u: BattleUnitSnapshot,
  side: "p" | "e",
  frame: BattleFrame,
  prevStats: Map<string, { atk: number; hp: number }>,
  ff: boolean,
  frameIdx: number,
) {
  const prev = prevStats.get(u.uid);
  return (
    <BattleCard
      key={u.uid}
      unit={u}
      side={side}
      actionObj={frame.actions?.[u.uid]}
      fastForward={ff}
      frameIdx={frameIdx}
      atkBaseDiff={u.atk - u.battleBaseAtk}
      hpBaseDiff={u.hp - u.battleBaseHp}
      atkDelta={prev ? u.atk - prev.atk : 0}
      hpDelta={prev ? u.hp - prev.hp : 0}
    />
  );
}

export function BattleVisualizer({ currentFrame, prevFrame, ff, frameIdx }: BattleVisualizerProps) {
  const prevStats = useMemo(() => buildPrevStats(prevFrame), [prevFrame]);
  const enemy = currentEnemyTeam.value;
  invariant(enemy != null, "BattleVisualizer rendered without currentEnemyTeam");

  return (
    <section
      aria-label="戦場"
      className="border-iron/30 bg-void relative flex h-56 min-w-0 shrink-0 flex-col overflow-hidden border-b p-2 md:h-64 md:p-4"
    >
      <GradientBackground />
      <div className="text-parchment-ghost text-body-xs relative z-10 mb-2 flex shrink-0 justify-between px-2 font-bold tracking-widest md:text-xs">
        <span>◀ 後衛</span>
        <span className="text-blood-muted">{enemy.teamType}</span>
        <span>後衛 ▶</span>
      </div>
      <div className="relative z-10 flex min-h-0 w-full min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden px-1 md:gap-4">
        <div
          role="group"
          aria-label="味方"
          className="z-10 flex min-w-0 flex-1 flex-row-reverse justify-start gap-1"
        >
          {currentFrame.pBoard.map((u) =>
            renderCard(u, "p", currentFrame, prevStats, ff, frameIdx),
          )}
        </div>
        <div className="z-0 flex h-full shrink-0 items-center" aria-hidden="true">
          <Swords size={20} className="text-tarnished-gold opacity-20" />
        </div>
        <div role="group" aria-label="敵" className="z-10 flex min-w-0 flex-1 justify-start gap-1">
          {currentFrame.eBoard.map((u) =>
            renderCard(u, "e", currentFrame, prevStats, ff, frameIdx),
          )}
        </div>
        <ParticleCanvas actions={currentFrame.actions ?? {}} frameIdx={frameIdx} ff={ff} />
      </div>
    </section>
  );
}
