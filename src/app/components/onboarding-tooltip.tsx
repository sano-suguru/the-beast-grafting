interface OnboardingTooltipProps {
  text: string;
  positionClass: string;
}

export function OnboardingTooltip({ text, positionClass }: OnboardingTooltipProps) {
  return (
    <div
      role="tooltip"
      className={`absolute ${positionClass} animate-tooltip pointer-events-none z-50 w-full max-w-[200px]`}
    >
      <div className="border-tarnished-gold-dim bg-void-surface text-parchment shadow-glow-gold-tooltip relative rounded border p-2.5 text-center">
        <p className="text-[11px] leading-relaxed font-black tracking-wide md:text-xs">{text}</p>
        <div className="border-tarnished-gold-dim bg-void-surface absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-r border-b"></div>
      </div>
    </div>
  );
}
