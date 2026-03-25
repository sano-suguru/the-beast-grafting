import type { Particle } from "./types";

const POOL_SIZE = 300;
const pool: Particle[] = [];

function createDefault(): Particle {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    ax: 0,
    ay: 0,
    size: 1,
    sizeEnd: 0,
    r: 255,
    g: 255,
    b: 255,
    a: 1,
    rEnd: 255,
    gEnd: 255,
    bEnd: 255,
    aEnd: 0,
    life: 0,
    maxLife: 0,
    rotation: 0,
    rotationSpeed: 0,
    shape: "circle",
    composite: "source-over",
    lineEndX: 0,
    lineEndY: 0,
    lineWidth: 1,
    seed: 0,
    wobble: false,
  };
}

export function acquire(): Particle {
  return pool.pop() ?? createDefault();
}

export function release(p: Particle): void {
  if (pool.length < POOL_SIZE) {
    pool.push(p);
  }
}

/**
 * パーティクルの共通フィールドをリセットし、life/maxLife を同期して配列に追加する。
 * acquire() 後に位置・速度・色などを設定した後、最後にこれを呼ぶ。
 */
export function finalize(
  p: Particle,
  into: Particle[],
  overrides?: Partial<Pick<Particle, "shape" | "composite" | "seed" | "wobble">>,
): void {
  p.maxLife = p.life;
  if (p.shape === "circle" || p.shape === "rect") {
    p.lineEndX = 0;
    p.lineEndY = 0;
  }
  if (overrides) {
    if (overrides.shape != null) p.shape = overrides.shape;
    if (overrides.composite != null) p.composite = overrides.composite;
    if (overrides.seed != null) p.seed = overrides.seed;
    if (overrides.wobble != null) p.wobble = overrides.wobble;
  }
  into.push(p);
}

/** @internal テスト専用 — プールをクリア */
export function __clearPool(): void {
  pool.length = 0;
}
