import { useMemo } from "preact/hooks";
import type { BattleFrame, UnitInstance } from "../../types";
import { currentEnemyTeam } from "../../state/game-store";
import { invariant } from "../../../shared/invariant";
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
  u: UnitInstance,
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
      atkBaseDiff={u.atk - u.baseAtk}
      hpBaseDiff={u.hp - u.baseHp}
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
      className="relative flex h-56 min-w-0 shrink-0 flex-col border-b border-zinc-900 bg-[#050505] p-2 md:h-64 md:p-4"
    >
      <div className="mb-2 flex shrink-0 justify-between px-2 text-[10px] font-bold tracking-widest text-zinc-500 md:text-xs">
        <span>あなたの群れ</span>
        <span className="text-red-900">狂宴</span>
        <span>{enemy.teamType}</span>
      </div>
      <div className="relative flex min-h-0 w-full min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden px-1 md:gap-4">
        <div
          role="group"
          aria-label="味方"
          className="z-10 flex min-w-0 flex-1 flex-row-reverse justify-start gap-1"
        >
          {currentFrame.pBoard.map((u) =>
            renderCard(u, "p", currentFrame, prevStats, ff, frameIdx),
          )}
        </div>
        <div className="z-0 h-full w-px shrink-0 bg-zinc-900/50" aria-hidden="true" />
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
