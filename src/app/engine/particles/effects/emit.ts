import type { EffectInstance, Particle } from "../types";
import { acquire, finalize } from "../pool";

let nextId = 0;

interface ParticleSpec {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  ax?: number;
  ay?: number;
  size: number;
  sizeEnd: number;
  r: number;
  g: number;
  b: number;
  a: number;
  rEnd: number;
  gEnd: number;
  bEnd: number;
  life: number;
  composite?: GlobalCompositeOperation;
  seed?: number;
  wobble?: boolean;
  shape?: Particle["shape"];
  rotation?: number;
  rotationSpeed?: number;
  lineEndX?: number;
  lineEndY?: number;
  lineWidth?: number;
  delay?: number;
}

function applyMotion(p: Particle, spec: ParticleSpec) {
  p.x = spec.x;
  p.y = spec.y;
  p.vx = spec.vx ?? 0;
  p.vy = spec.vy ?? 0;
  p.ax = spec.ax ?? 0;
  p.ay = spec.ay ?? 0;
}

function applyVisuals(p: Particle, spec: ParticleSpec) {
  p.size = spec.size;
  p.sizeEnd = spec.sizeEnd;
  p.r = spec.r;
  p.g = spec.g;
  p.b = spec.b;
  p.a = spec.a;
  p.rEnd = spec.rEnd;
  p.gEnd = spec.gEnd;
  p.bEnd = spec.bEnd;
  p.aEnd = 0;
  p.life = spec.life + (spec.delay ?? 0);
  p.rotation = spec.rotation ?? 0;
  p.rotationSpeed = spec.rotationSpeed ?? 0;
}

function applyLineShape(p: Particle, spec: ParticleSpec) {
  if (spec.shape !== "line") return;
  p.lineEndX = spec.lineEndX ?? 0;
  p.lineEndY = spec.lineEndY ?? 0;
  p.lineWidth = spec.lineWidth ?? 1;
}

export function emit(spec: ParticleSpec, into: Particle[]): void {
  const p = acquire();
  applyMotion(p, spec);
  applyVisuals(p, spec);
  applyLineShape(p, spec);
  finalize(p, into, {
    composite: spec.composite ?? "source-over",
    seed: spec.seed ?? 0,
    shape: spec.shape ?? "circle",
    wobble: spec.wobble ?? false,
  });
}

export function makeInstance(
  type: string,
  particles: Particle[],
  duration: number,
  x: number,
  y: number,
  drawOverlay?: EffectInstance["drawOverlay"],
): EffectInstance {
  const inst: EffectInstance = {
    id: nextId++,
    type,
    particles,
    elapsed: 0,
    duration,
    originX: x,
    originY: y,
  };
  if (drawOverlay) inst.drawOverlay = drawOverlay;
  return inst;
}

export function rng(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function polar(angle: number, speed: number): { vx: number; vy: number } {
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
}

/** @internal テスト専用 — ID カウンターをリセット */
export function __resetNextId(): void {
  nextId = 0;
}
