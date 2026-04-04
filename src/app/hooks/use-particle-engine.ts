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

type DprRef = { current: number };

interface EngineRefs {
  canvasRef: RefObject<HTMLCanvasElement>;
  effectsRef: { current: EffectInstance[] };
  rafRef: { current: number };
  lastTimeRef: { current: number };
  runningRef: { current: boolean };
  dprRef: DprRef;
  tickRef: { current: (now: number) => void };
}

function syncCanvasSize(canvas: HTMLCanvasElement, parent: HTMLElement, dprRef: DprRef) {
  const dpr = window.devicePixelRatio || 1;
  dprRef.current = dpr;
  const { width, height } = parent.getBoundingClientRect();
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

function resolveEffectPosition(
  uid: string,
  action: BattleAction,
  canvasRect: DOMRect,
): { cx: number; cy: number } | null {
  if (action.type === "clash") {
    return { cx: canvasRect.width / 2, cy: canvasRect.height / 2 };
  }
  const el = document.querySelector(`[data-uid="${CSS.escape(uid)}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    cx: rect.left + rect.width / 2 - canvasRect.left,
    cy: rect.top + rect.height / 2 - canvasRect.top,
  };
}

function createTick(refs: EngineRefs): (now: number) => void {
  return (now: number) => {
    const canvas = refs.canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dt = Math.min((now - refs.lastTimeRef.current) / 1000, 0.05);
    refs.lastTimeRef.current = now;
    updateEffects(refs.effectsRef.current, dt);
    refs.effectsRef.current = pruneEffects(refs.effectsRef.current);
    const dpr = refs.dprRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderEffects(ctx, refs.effectsRef.current);
    if (refs.effectsRef.current.length > 0) {
      refs.rafRef.current = requestAnimationFrame((t) => refs.tickRef.current(t));
    } else {
      refs.runningRef.current = false;
    }
  };
}

function useCanvasResize(canvasRef: RefObject<HTMLCanvasElement>, dprRef: DprRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const sync = () => syncCanvasSize(canvas, parent, dprRef);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [canvasRef, dprRef]);
}

export function useParticleEngine(): UseParticleEngineResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const effectsRef = useRef<EffectInstance[]>([]);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const runningRef = useRef(false);
  const dprRef = useRef(1);
  const tickRef = useRef<(now: number) => void>(noop);
  const refs: EngineRefs = {
    canvasRef,
    effectsRef,
    rafRef,
    lastTimeRef,
    runningRef,
    dprRef,
    tickRef,
  };

  tickRef.current = createTick(refs);

  const startLoop = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame((t) => tickRef.current(t));
  }, []);

  useCanvasResize(canvasRef, dprRef);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const spawnEffects = useCallback(
    (actions: Record<string, BattleAction>, ff: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const canvasRect = canvas.getBoundingClientRect();
      for (const [uid, action] of Object.entries(actions)) {
        const pos = resolveEffectPosition(uid, action, canvasRect);
        if (!pos) continue;
        const effect = createEffect(action.type, pos.cx, pos.cy, { fast: ff });
        if (effect) effectsRef.current.push(effect);
      }
      if (effectsRef.current.length > 0) startLoop();
    },
    [startLoop],
  );

  return { canvasRef, spawnEffects };
}
