import type { EffectInstance, Particle } from "./types";
import { lerp, easeInQuad, easeOutQuad } from "./easing";
import { release } from "./pool";

const MAX_PARTICLES = 200;
const HIDDEN = { r: 0, g: 0, b: 0, a: 0, size: 0 } as const;

/** 全エフェクトのパーティクルを物理更新し、寿命切れを除去する */
export function updateEffects(effects: EffectInstance[], dt: number): void {
  for (const effect of effects) {
    effect.elapsed += dt;
    const alive: Particle[] = [];
    for (const p of effect.particles) {
      p.life -= dt;
      if (p.life <= 0) {
        release(p);
        continue;
      }
      p.vx += p.ax * dt;
      p.vy += p.ay * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotationSpeed * dt;
      if (p.wobble) {
        p.vx = Math.sin(p.life * 8 + p.seed) * 15;
      }
      alive.push(p);
    }
    effect.particles = alive;
  }
  enforceLimit(effects);
}

/** 完了したエフェクトを除去し、残りを返す */
export function pruneEffects(effects: EffectInstance[]): EffectInstance[] {
  return effects.filter((e) => e.elapsed < e.duration || e.particles.length > 0);
}

/** パーティクル総数が上限を超えたら最短寿命のものから除去 */
export function enforceLimit(effects: EffectInstance[]): void {
  let total = 0;
  for (const e of effects) total += e.particles.length;
  if (total <= MAX_PARTICLES) return;

  const toRemove = total - MAX_PARTICLES;
  const lives: number[] = [];
  for (const e of effects) {
    for (const p of e.particles) lives.push(p.life);
  }
  lives.sort((a, b) => a - b);
  const threshold = lives[toRemove - 1]!;

  let killed = 0;
  for (const e of effects) {
    for (const p of e.particles) {
      if (killed < toRemove && p.life <= threshold) {
        p.life = 0;
        killed++;
      }
    }
  }
}

/** パーティクルの色・サイズを寿命に応じて補間した値を取得 */
export function interpolated(p: Particle): {
  r: number;
  g: number;
  b: number;
  a: number;
  size: number;
} {
  const progress = 1 - p.life / p.maxLife;
  if (progress < 0) return HIDDEN;
  const tAlpha = easeInQuad(progress);
  const tSize = easeOutQuad(progress);
  return {
    r: lerp(p.r, p.rEnd, progress),
    g: lerp(p.g, p.gEnd, progress),
    b: lerp(p.b, p.bEnd, progress),
    a: lerp(p.a, p.aEnd, tAlpha),
    size: lerp(p.size, p.sizeEnd, tSize),
  };
}
