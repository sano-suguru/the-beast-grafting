import { Skull } from "lucide-preact";

interface OnboardingTooltipProps {
  text: string;
  positionClass: string;
}

export function OnboardingTooltip({ text, positionClass }: OnboardingTooltipProps) {
  return (
    <div
      className={`absolute ${positionClass} animate-tooltip pointer-events-none z-50 w-full max-w-[200px]`}
    >
      <div className="relative rounded border border-red-800 bg-red-950 p-2.5 text-center text-red-100 shadow-[0_4px_15px_rgba(153,27,27,0.5)]">
        <Skull size={16} className="mx-auto mb-1.5 text-red-600" />
        <p className="text-[11px] leading-relaxed font-black tracking-wide md:text-xs">{text}</p>
        <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-r border-b border-red-800 bg-red-950"></div>
      </div>
    </div>
  );
}
