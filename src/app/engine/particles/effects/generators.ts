import type { EffectInstance, Particle } from "../types";
import { acquire, finalize } from "../pool";
import { clamp01, easeOutQuad, easeOutCubic, easeInCubic } from "../easing";

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
  /** 発生遅延（秒）— life に加算され、raw < 0 の間は非表示 */
  delay?: number;
}

function emit(spec: ParticleSpec, into: Particle[]): void {
  const p = acquire();
  p.x = spec.x;
  p.y = spec.y;
  p.vx = spec.vx ?? 0;
  p.vy = spec.vy ?? 0;
  p.ax = spec.ax ?? 0;
  p.ay = spec.ay ?? 0;
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
  if (spec.shape === "line") {
    p.lineEndX = spec.lineEndX ?? 0;
    p.lineEndY = spec.lineEndY ?? 0;
    p.lineWidth = spec.lineWidth ?? 1;
  }
  finalize(p, into, {
    composite: spec.composite ?? "source-over",
    seed: spec.seed ?? 0,
    shape: spec.shape ?? "circle",
    wobble: spec.wobble ?? false,
  });
}

function makeInstance(
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

function rng(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function polar(angle: number, speed: number): { vx: number; vy: number } {
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
}

function createDamage(x: number, y: number, fast: boolean): EffectInstance {
  const ps: Particle[] = [];
  const n = fast ? 8 : 15;
  for (let i = 0; i < n; i++) {
    const { vx, vy } = polar(Math.random() * Math.PI * 2, rng(40, 160));
    const bright = Math.random() < 0.3;
    emit(
      {
        x: x + rng(-8, 8),
        y: y + rng(-8, 8),
        vx,
        vy,
        ay: 200,
        size: rng(1.5, 4.5),
        sizeEnd: 0.5,
        r: bright ? 220 : rng(140, 200),
        g: rng(0, 20),
        b: rng(0, 20),
        a: 0.9,
        rEnd: 80,
        gEnd: 5,
        bEnd: 5,
        life: rng(0.3, 0.55),
        delay: rng(0, 0.04),
      },
      ps,
    );
  }
  for (let i = 0; i < (fast ? 1 : 2); i++) {
    const angle = rng(-Math.PI / 4, Math.PI / 4);
    const len = rng(20, 45);
    emit(
      {
        x: x - (len / 2) * Math.cos(angle),
        y: y - (len / 2) * Math.sin(angle),
        size: 2,
        sizeEnd: 2,
        r: 255,
        g: 220,
        b: 220,
        a: 1,
        rEnd: 255,
        gEnd: 220,
        bEnd: 220,
        life: 0.2,
        rotation: angle,
        shape: "line",
        lineEndX: len * Math.cos(angle),
        lineEndY: len * Math.sin(angle),
        lineWidth: 2,
        composite: "lighter",
      },
      ps,
    );
  }

  return makeInstance("damage", ps, fast ? 0.2 : 0.5, x, y, drawSlashFlash(x, y));
}

/** 斬撃フラッシュオーバーレイ — quadratic bezier curve */
function drawSlashFlash(ox: number, oy: number): EffectInstance["drawOverlay"] {
  return (ctx, progress) => {
    if (progress > 0.4) return;
    const fade = clamp01(1 - progress / 0.4);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = fade * 0.6;
    ctx.shadowBlur = 6;
    ctx.shadowColor = "rgba(255,150,150,0.6)";
    ctx.strokeStyle = "rgb(255,200,200)";
    ctx.lineWidth = 3 * fade;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ox - 25, oy - 15);
    ctx.quadraticCurveTo(ox + 5, oy - 5, ox + 25, oy + 10);
    ctx.stroke();
  };
}

function createClash(x: number, y: number, fast: boolean): EffectInstance {
  const ps: Particle[] = [];
  for (let i = 0; i < (fast ? 6 : 12); i++) {
    const { vx, vy } = polar(Math.random() * Math.PI * 2, rng(80, 240));
    emit(
      {
        x,
        y,
        vx,
        vy,
        size: rng(1.5, 3),
        sizeEnd: 0.3,
        r: 220,
        g: 210,
        b: 200,
        a: 0.8,
        rEnd: 150,
        gEnd: 140,
        bEnd: 130,
        life: rng(0.15, 0.35),
        delay: rng(0, 0.03),
        rotationSpeed: rng(-5, 5),
        shape: "rect",
        composite: "lighter",
      },
      ps,
    );
  }

  return makeInstance("clash", ps, fast ? 0.15 : 0.4, x, y, drawShockwave(x, y));
}

/** 衝撃波オーバーレイ — 二重リング拡大 + 放射線 */
function drawShockwave(ox: number, oy: number): EffectInstance["drawOverlay"] {
  return (ctx, progress) => {
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(240,240,255,0.5)";
    ctx.globalAlpha = clamp01(1 - progress) * 0.7;
    ctx.strokeStyle = "rgb(240,240,255)";
    ctx.lineWidth = 3 * (1 - progress);
    ctx.beginPath();
    ctx.arc(ox, oy, easeOutQuad(progress) * 70, 0, Math.PI * 2);
    ctx.stroke();
    const innerT = clamp01((progress - 0.12) / 0.88);
    if (innerT > 0) {
      ctx.globalAlpha = clamp01(1 - innerT) * 0.5;
      ctx.strokeStyle = "rgb(200,180,160)";
      ctx.lineWidth = 2 * (1 - innerT);
      ctx.beginPath();
      ctx.arc(ox, oy, easeOutQuad(innerT) * 50, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (progress < 0.7) {
      const lt = progress / 0.7;
      ctx.globalAlpha = clamp01(1 - lt) * 0.5;
      ctx.strokeStyle = "rgb(255,255,255)";
      ctx.lineWidth = 1.5 * (1 - lt);
      const len = 10 + easeOutQuad(lt) * 15;
      for (let j = 0; j < 8; j++) {
        const a = (j * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(ox + Math.cos(a) * 5, oy + Math.sin(a) * 5);
        ctx.lineTo(ox + Math.cos(a) * len, oy + Math.sin(a) * len);
        ctx.stroke();
      }
    }
  };
}

function createSkill(x: number, y: number, fast: boolean): EffectInstance {
  const ps: Particle[] = [];
  const particleCount = fast ? 10 : 22;
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = rng(15, 40);
    const green = Math.random() < 0.2;
    emit(
      {
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        vx: Math.cos(angle + Math.PI / 2) * 30,
        vy: rng(-70, -30),
        size: rng(1.5, 3.5),
        sizeEnd: rng(0.3, 0.8),
        r: green ? 80 : 160,
        g: green ? 120 : 130,
        b: green ? 40 : 40,
        a: 0.6,
        rEnd: green ? 40 : 80,
        gEnd: green ? 60 : 60,
        bEnd: 20,
        life: rng(0.35, 0.6),
        delay: rng(0, 0.06),
        composite: "lighter",
        seed: angle,
      },
      ps,
    );
  }
  return makeInstance("skill", ps, fast ? 0.18 : 0.5, x, y, drawRuneCircle(x, y));
}

/** 呪文陣オーバーレイ — 二重円 + 6本ルーン放射線（絶対座標） */
function drawRuneCircle(ox: number, oy: number): EffectInstance["drawOverlay"] {
  return (ctx, progress, elapsed) => {
    const maxR = 34;
    const r = maxR * clamp01(progress / 0.3);
    const fade = progress > 0.6 ? clamp01(1 - (progress - 0.6) / 0.4) : 1;
    const cx = ox;
    const cy = oy + 20;
    const theta = elapsed * Math.PI * 2;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = fade * 0.6;
    ctx.shadowBlur = 6;
    ctx.shadowColor = "rgba(245,180,60,0.5)";
    ctx.strokeStyle = "rgba(200,160,50,0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = "rgba(245,180,60,0.5)";
    for (let j = 0; j < 6; j++) {
      const a = (j * Math.PI) / 3 + theta;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3);
      ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
      ctx.stroke();
    }
  };
}

function createSummon(x: number, y: number, fast: boolean): EffectInstance {
  const ps: Particle[] = [];
  for (let i = 0; i < (fast ? 8 : 18); i++) {
    const blue = Math.random() < 0.3;
    emit(
      {
        x: x + rng(-20, 20),
        y: y + 30 + rng(-2, 2),
        vx: rng(-10, 10),
        vy: rng(-100, -40),
        size: rng(4, 8),
        sizeEnd: rng(8, 14),
        r: blue ? 80 : 140,
        g: blue ? 60 : 70,
        b: blue ? 180 : 200,
        a: 0.5,
        rEnd: blue ? 60 : 100,
        gEnd: blue ? 40 : 40,
        bEnd: blue ? 140 : 160,
        life: rng(0.3, 0.6),
        delay: rng(0, 0.15),
        composite: "screen",
      },
      ps,
    );
  }
  return makeInstance("summon", ps, fast ? 0.2 : 0.6, x, y, drawRift(x, y));
}

/** 裂け目オーバーレイ — ジグザグ線が開く→維持→閉じる + 光彩 */
function drawRift(ox: number, oy: number): EffectInstance["drawOverlay"] {
  const cy = oy + 35;
  return (ctx, progress) => {
    const maxH = 22;
    let hw: number;
    if (progress < 0.33) hw = maxH * easeOutCubic(progress / 0.33);
    else if (progress < 0.75) hw = maxH;
    else hw = maxH * (1 - easeInCubic((progress - 0.75) / 0.25));
    if (hw < 0.5) return;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = "rgba(150,80,220,0.8)";
    ctx.strokeStyle = "rgba(180,100,255,0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ox - hw, cy);
    ctx.lineTo(ox - hw * 0.4, cy - 2);
    ctx.lineTo(ox, cy + 1);
    ctx.lineTo(ox + hw * 0.4, cy - 1);
    ctx.lineTo(ox + hw, cy);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = "rgba(120,60,180,0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ox - hw, cy);
    ctx.lineTo(ox - hw * 0.5, cy - 3);
    ctx.lineTo(ox - hw * 0.1, cy + 2);
    ctx.lineTo(ox + hw * 0.3, cy - 2);
    ctx.lineTo(ox + hw * 0.6, cy + 1);
    ctx.lineTo(ox + hw, cy);
    ctx.stroke();
  };
}

function createDeath(x: number, y: number, fast: boolean): EffectInstance {
  const ps: Particle[] = [];
  for (let i = 0; i < (fast ? 7 : 14); i++) {
    const purple = Math.random() < 0.25;
    emit(
      {
        x: x + rng(-12, 12),
        y: y + rng(-10, 10),
        vy: rng(-70, -20),
        size: rng(2, 4),
        sizeEnd: rng(0.3, 0.8),
        r: 180,
        g: purple ? 160 : 200,
        b: purple ? 220 : 240,
        a: 0.7,
        rEnd: purple ? 150 : 140,
        gEnd: purple ? 130 : 160,
        bEnd: purple ? 200 : 220,
        life: rng(0.4, 0.7),
        delay: rng(0, 0.1),
        composite: "lighter",
        seed: Math.random() * Math.PI * 2,
        wobble: true,
      },
      ps,
    );
  }

  return makeInstance("death", ps, fast ? 0.25 : 0.7, x, y, drawSoulRing(x, y));
}

/** 魂の残像リングオーバーレイ — 拡大リング + 内側の薄い二重リング */
function drawSoulRing(ox: number, oy: number): EffectInstance["drawOverlay"] {
  return (ctx, progress) => {
    const outerR = easeOutQuad(progress) * 30;
    const fade = clamp01(1 - progress);
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "rgba(160,180,230,0.4)";
    // 外リング
    ctx.globalAlpha = fade * 0.4;
    ctx.strokeStyle = "rgb(160,180,230)";
    ctx.lineWidth = 1.5 - progress * 0.7;
    ctx.beginPath();
    ctx.arc(ox, oy, outerR, 0, Math.PI * 2);
    ctx.stroke();
    // 内リング（遅延して拡大、より薄い）
    const innerProgress = clamp01((progress - 0.15) / 0.85);
    if (innerProgress > 0) {
      ctx.globalAlpha = clamp01(1 - innerProgress) * 0.2;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(ox, oy, easeOutQuad(innerProgress) * 20, 0, Math.PI * 2);
      ctx.stroke();
    }
  };
}

function createBuffHeal(x: number, y: number, fast: boolean, isHeal: boolean): EffectInstance {
  const ps: Particle[] = [];
  for (let i = 0; i < (fast ? 7 : 16); i++) {
    const bright = Math.random() < 0.2;
    const [r, g, b, re, ge, be] = isHeal
      ? [bright ? 255 : 240, bright ? 240 : 200, bright ? 180 : 60, 200, 160, 40]
      : [bright ? 100 : 40, bright ? 240 : 200, bright ? 150 : 100, 20, 160, 80];
    emit(
      {
        x: x + rng(-18, 18),
        y: y + 5 + Math.random() * 25,
        vx: rng(-5, 5),
        vy: rng(-90, -40),
        size: rng(1.5, 3.5),
        sizeEnd: rng(0.2, 0.5),
        r,
        g,
        b,
        a: 0.8,
        rEnd: re,
        gEnd: ge,
        bEnd: be,
        life: rng(0.3, 0.55),
        delay: rng(0, 0.06),
        composite: "lighter",
        seed: Math.random() * Math.PI * 2,
        wobble: true,
      },
      ps,
    );
  }

  const [gr, gg, gb] = isHeal ? [240, 200, 60] : [40, 200, 100];
  const overlay = (ctx: CanvasRenderingContext2D, progress: number): void => {
    const radius = progress < 0.3 ? (progress / 0.3) * 25 : 25 * (1 - (progress - 0.3) / 0.7);
    if (radius < 0.5) return;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = clamp01(progress < 0.3 ? 0.15 : 0.15 * (1 - (progress - 0.3) / 0.7));
    ctx.shadowBlur = 12;
    ctx.shadowColor = `rgba(${gr},${gg},${gb},0.4)`;
    ctx.fillStyle = `rgb(${gr},${gg},${gb})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  return makeInstance(isHeal ? "heal" : "buff", ps, fast ? 0.18 : 0.55, x, y, overlay);
}

type Gen = (x: number, y: number, config: { fast: boolean }) => EffectInstance;

const EFFECT_MAP: Record<string, Gen> = {
  damage: (x, y, c) => createDamage(x, y, c.fast),
  clash: (x, y, c) => createClash(x, y, c.fast),
  skill: (x, y, c) => createSkill(x, y, c.fast),
  summon: (x, y, c) => createSummon(x, y, c.fast),
  death: (x, y, c) => createDeath(x, y, c.fast),
  buff: (x, y, c) => createBuffHeal(x, y, c.fast, false),
  heal: (x, y, c) => createBuffHeal(x, y, c.fast, true),
};

export function createEffect(
  type: string,
  x: number,
  y: number,
  config: { fast: boolean },
): EffectInstance | null {
  const gen = EFFECT_MAP[type];
  if (!gen) return null;
  return gen(x, y, config);
}

/** @internal テスト専用 — ID カウンターをリセット */
export function __resetNextId(): void {
  nextId = 0;
}
