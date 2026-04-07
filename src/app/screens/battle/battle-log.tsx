import { useEffect, useRef } from "preact/hooks";
import type { BattleFrame } from "../../types";
import { LogIcon } from "../../components/log-icon";
import { LogSegments } from "../../components/log-rich-text";

interface BattleLogProps {
  frames: BattleFrame[];
  frameIdx: number;
}

function getLogTextClass(type: string): string {
  if (type === "info" || type === "result") return "text-parchment font-bold";
  if (type === "death") return "text-parchment-dim";
  return "text-parchment";
}

export function BattleLog({ frames, frameIdx }: BattleLogProps) {
  const logContainerRef = useRef<HTMLElement>(null);
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
    <section
      role="log"
      aria-label="戦闘ログ"
      ref={logContainerRef}
      onScroll={handleLogScroll}
      className="bg-void min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto scroll-smooth p-3 pb-8 font-mono text-[10px] leading-relaxed md:p-4 md:text-[11px]"
    >
      {frames.slice(0, frameIdx + 1).map((frame) => (
        <div
          key={frame.log.id}
          className="animate-fade-in border-iron/40 mb-2 flex w-full gap-2 border-l-2 pl-2 md:mb-3"
        >
          <LogIcon entry={frame.log} />
          <div className={`min-w-0 flex-1 break-words ${getLogTextClass(frame.log.type)}`}>
            <LogSegments segments={frame.log.segments} />
          </div>
        </div>
      ))}
    </section>
  );
}
