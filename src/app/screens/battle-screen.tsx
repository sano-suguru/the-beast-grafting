import { useEffect } from "preact/hooks";
import { battleFrames, currentFrameIdx, fastForward } from "../state/game-store";
import { playSE } from "../engine/audio";
import { BattleVisualizer } from "./battle/battle-visualizer";
import { BattleLog } from "./battle/battle-log";
import { BattleFooter } from "./battle/battle-footer";
import { FRAME_DELAY_NORMAL, FRAME_DELAY_FAST } from "../engine/constants";
import type { LogType, SoundType } from "../types";

const SE_MAP: Partial<Record<LogType, SoundType>> = {
  clash: "clash",
  damage: "damage",
  defend: "defend",
  skill: "skill",
  death: "death",
};

export function BattleScreen() {
  const frames = battleFrames.value;
  const frameIdx = currentFrameIdx.value;
  const ff = fastForward.value;
  const currentFrame = frames[frameIdx];
  if (!currentFrame) {
    console.warn(`[BUG] frameIdx ${frameIdx} out of bounds (length=${frames.length})`);
    return null;
  }
  const isFinished = frameIdx >= frames.length - 1;

  useEffect(() => {
    if (frameIdx >= frames.length - 1) return;
    const timer = setTimeout(
      () => {
        const nextIdx = frameIdx + 1;
        currentFrameIdx.value = nextIdx;
        const logType = frames[nextIdx]?.log?.type;
        const se = logType ? SE_MAP[logType] : undefined;
        if (se) playSE(se);
      },
      ff ? FRAME_DELAY_FAST : FRAME_DELAY_NORMAL,
    );
    return () => clearTimeout(timer);
  }, [frameIdx, frames, ff]);

  return (
    <div className="relative mx-auto flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden border-x border-zinc-900 bg-zinc-950 font-serif text-zinc-300">
      <BattleVisualizer currentFrame={currentFrame} ff={ff} frameIdx={frameIdx} />
      <BattleLog frames={frames} frameIdx={frameIdx} />
      <BattleFooter isFinished={isFinished} />
    </div>
  );
}
