import { useRef, useEffect, useCallback } from "preact/hooks";
import type { RefObject } from "preact";
import type { BattleAction } from "../types";
import type { EffectInstance } from "../engine/particles/types";
import { createEffect } from "../engine/particles/effects/generators";
import { updateEffects, pruneEffects } from "../engine/particles/update";
import { renderEffects } from "../engine/particles/render";

const noop = () => {};

interface UseParticleEngineResult {
  canvasRef: RefObject<HTMLCanvasElement>;
  spawnEffects: (actions: Record<string, BattleAction>, ff: boolean) => void;
}

export function useParticleEngine(): UseParticleEngineResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const effectsRef = useRef<EffectInstance[]>([]);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const runningRef = useRef(false);
  const dprRef = useRef(1);
  const tickRef = useRef<(now: number) => void>(noop);

  // tickRef 経由で常に最新クロージャを参照
  tickRef.current = (now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
    lastTimeRef.current = now;

    updateEffects(effectsRef.current, dt);
    effectsRef.current = pruneEffects(effectsRef.current);

    const dpr = dprRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderEffects(ctx, effectsRef.current);

    if (effectsRef.current.length > 0) {
      rafRef.current = requestAnimationFrame((t) => tickRef.current(t));
    } else {
      runningRef.current = false;
    }
  };

  const startLoop = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame((t) => tickRef.current(t));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const sync = () => {
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      const { width, height } = parent.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const spawnEffects = useCallback(
    (actions: Record<string, BattleAction>, ff: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const canvasRect = canvas.getBoundingClientRect();

      for (const [uid, action] of Object.entries(actions)) {
        let cx: number;
        let cy: number;

        if (action.type === "clash") {
          cx = canvasRect.width / 2;
          cy = canvasRect.height / 2;
        } else {
          const el = document.querySelector(`[data-uid="${CSS.escape(uid)}"]`);
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          cx = rect.left + rect.width / 2 - canvasRect.left;
          cy = rect.top + rect.height / 2 - canvasRect.top;
        }

        const effect = createEffect(action.type, cx, cy, { fast: ff });
        if (effect) {
          effectsRef.current.push(effect);
        }
      }

      if (effectsRef.current.length > 0) {
        startLoop();
      }
    },
    [startLoop],
  );

  return { canvasRef, spawnEffects };
}
