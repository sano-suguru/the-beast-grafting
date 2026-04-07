import { Shield } from "lucide-preact";
import type { LogSegment, LogSegmentKind } from "../types";

const KIND_STYLES: Record<
  Exclude<LogSegmentKind, "hp">,
  { className: string; wrap: [string, string] }
> = {
  unit: { className: "font-bold text-parchment-bright", wrap: ["[", "]"] },
  effect: {
    className: "font-bold text-tarnished-gold bg-tarnished-gold-dim/30 rounded-sm px-0.5",
    wrap: ["【", "】"],
  },
  stat: { className: "font-mono text-[9px] text-parchment-dim", wrap: ["(", ")"] },
};

export function LogSegments({ segments }: { segments: LogSegment[] }) {
  return (
    <>
      {segments.map((s, i) => {
        if (typeof s === "string") return s;
        if (s.kind === "hp") {
          return (
            <span
              key={i}
              className="text-parchment-dim inline-flex items-baseline gap-px font-mono text-[9px]"
            >
              <Shield size={9} className="self-center" />
              {s.text}
            </span>
          );
        }
        const style = KIND_STYLES[s.kind];
        return (
          <span key={i} className={style.className}>
            {style.wrap[0]}
            {s.text}
            {style.wrap[1]}
          </span>
        );
      })}
    </>
  );
}
