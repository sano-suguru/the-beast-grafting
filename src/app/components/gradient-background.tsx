interface Props {
  gradient?: string | undefined;
  glowColor?: string | undefined;
}

const DEFAULT_GRADIENT = "from-red-950/40 via-zinc-950 to-black";
const DEFAULT_GLOW = "rgba(127,29,29,0.15)";

export function GradientBackground({ gradient, glowColor }: Props) {
  return (
    <>
      <div
        className={`absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${gradient ?? DEFAULT_GRADIENT}`}
      />
      <div
        className="animate-glow-pulse absolute inset-0 z-0"
        style={{
          background: `radial-gradient(ellipse at center, ${glowColor ?? DEFAULT_GLOW} 0%, transparent 70%)`,
        }}
      />
    </>
  );
}
