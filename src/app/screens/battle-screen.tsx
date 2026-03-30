import { useEffect } from "preact/hooks";
import { battleFrames, currentFrameIdx, fastForward } from "../state/game-store";
import { playSE } from "../engine/audio";
import { BattleVisualizer } from "./battle/battle-visualizer";
import { BattleLog } from "./battle/battle-log";
import { BattleFooter } from "./battle/battle-footer";
import type { LogType, SoundType } from "../types";

const FRAME_DELAY_NORMAL = 700;
const FRAME_DELAY_FAST = 150;

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
    const nextFrame = frames[frameIdx + 1];
    const delay = ff ? FRAME_DELAY_FAST : (nextFrame?.delay ?? FRAME_DELAY_NORMAL);
    const timer = setTimeout(() => {
      currentFrameIdx.value = frameIdx + 1;
      const logType = nextFrame?.log?.type;
      const se = logType ? SE_MAP[logType] : undefined;
      if (se) playSE(se);
    }, delay);
    return () => clearTimeout(timer);
  }, [frameIdx, frames, ff]);

  return (
    <main className="relative mx-auto flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden border-x border-zinc-900 bg-zinc-950 font-serif text-zinc-300">
      <BattleVisualizer
        currentFrame={currentFrame}
        prevFrame={frameIdx > 0 ? frames[frameIdx - 1] : undefined}
        ff={ff}
        frameIdx={frameIdx}
      />
      <BattleLog frames={frames} frameIdx={frameIdx} />
      <BattleFooter isFinished={isFinished} />
    </main>
  );
}
