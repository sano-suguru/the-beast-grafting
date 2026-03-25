import { useEffect, useRef } from "preact/hooks";
import type { BattleAction } from "../types";
import { useParticleEngine } from "../hooks/use-particle-engine";

interface ParticleCanvasProps {
  actions: Record<string, BattleAction>;
  frameIdx: number;
  ff: boolean;
}

export function ParticleCanvas({ actions, frameIdx, ff }: ParticleCanvasProps) {
  const { canvasRef, spawnEffects } = useParticleEngine();
  const ffRef = useRef(ff);
  ffRef.current = ff;

  useEffect(() => {
    spawnEffects(actions, ffRef.current);
  }, [frameIdx, spawnEffects, actions]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-40" />;
}
