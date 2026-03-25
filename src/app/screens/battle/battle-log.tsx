import { useEffect, useRef } from "preact/hooks";
import type { BattleFrame } from "../../types";
import { LogIcon } from "../../components/log-icon";

interface BattleLogProps {
  frames: BattleFrame[];
  frameIdx: number;
}

function getLogTextClass(type: string): string {
  if (type === "info" || type === "result") return "text-zinc-400 font-bold";
  if (type === "death") return "text-zinc-500";
  return "text-zinc-300";
}

export function BattleLog({ frames, frameIdx }: BattleLogProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const handleLogScroll = () => {
    const el = logContainerRef.current;
    if (!el) return;
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
  };

  useEffect(() => {
    if (autoScrollRef.current && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [frameIdx]);

  return (
    <div
      ref={logContainerRef}
      onScroll={handleLogScroll}
      className="min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto scroll-smooth bg-[#0a0a0a] p-3 pb-8 font-mono text-[10px] leading-relaxed md:p-4 md:text-[11px]"
    >
      {frames.slice(0, frameIdx + 1).map((frame) => (
        <div key={frame.log.id} className="animate-fade-in mb-2 flex w-full gap-2 md:mb-3">
          <LogIcon entry={frame.log} />
          <div className={`min-w-0 flex-1 break-words ${getLogTextClass(frame.log.type)}`}>
            {frame.log.text}
          </div>
        </div>
      ))}
    </div>
  );
}
