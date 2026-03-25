import type { BattleFrame } from "../../types";
import { currentEnemyTeam } from "../../state/game-store";
import { BattleCard } from "../../components/battle-card";

interface BattleVisualizerProps {
  currentFrame: BattleFrame;
  ff: boolean;
  frameIdx: number;
}

export function BattleVisualizer({ currentFrame, ff, frameIdx }: BattleVisualizerProps) {
  return (
    <div className="relative flex h-56 min-w-0 shrink-0 flex-col border-b border-zinc-900 bg-[#050505] p-2 md:h-64 md:p-4">
      <div className="mb-2 flex shrink-0 justify-between px-2 text-[10px] font-bold tracking-widest text-zinc-500 md:text-xs">
        <span>あなたの群れ</span>
        <span className="text-red-900">狂宴</span>
        <span>{currentEnemyTeam.value?.teamType || "異端審問隊"}</span>
      </div>
      <div className="relative flex min-h-0 w-full min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden px-1 md:gap-4">
        <div className="z-10 flex min-w-0 flex-1 flex-row-reverse justify-start gap-1">
          {currentFrame.pBoard.map((u) => (
            <BattleCard
              key={u.uid}
              unit={u}
              side="p"
              actionObj={currentFrame.actions?.[u.uid]}
              fastForward={ff}
              frameIdx={frameIdx}
            />
          ))}
        </div>
        <div className="z-0 h-full w-px shrink-0 bg-zinc-900/50" />
        <div className="z-10 flex min-w-0 flex-1 justify-start gap-1">
          {currentFrame.eBoard.map((u) => (
            <BattleCard
              key={u.uid}
              unit={u}
              side="e"
              actionObj={currentFrame.actions?.[u.uid]}
              fastForward={ff}
              frameIdx={frameIdx}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
