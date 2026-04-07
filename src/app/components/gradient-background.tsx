interface Props {
  gradient?: string | undefined;
  glowColor?: string | undefined;
}

const DEFAULT_GRADIENT = "from-blood-deep/30 via-void to-black";
const DEFAULT_GLOW = "color-mix(in srgb, var(--color-tarnished-gold) 6%, transparent)";

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
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{ boxShadow: "inset 0 0 150px 60px rgba(0,0,0,0.8)" }}
      />
    </>
  );
}
