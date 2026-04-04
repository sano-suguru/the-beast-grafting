import type { EffectInstance, Particle } from "../types";
import { clamp01 } from "../easing";
import { emit, makeInstance, rng, polar } from "./emit";
import { drawSlashFlash, drawShockwave, drawRuneCircle, drawRift, drawSoulRing } from "./overlays";

function emitBloodDrops(ps: Particle[], x: number, y: number, count: number) {
  for (let i = 0; i < count; i++) {
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
}

function emitSlashLines(ps: Particle[], x: number, y: number, count: number) {
  for (let i = 0; i < count; i++) {
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
}

function createDamage(x: number, y: number, fast: boolean): EffectInstance {
  const ps: Particle[] = [];
  emitBloodDrops(ps, x, y, fast ? 8 : 15);
  emitSlashLines(ps, x, y, fast ? 1 : 2);
  return makeInstance("damage", ps, fast ? 0.2 : 0.5, x, y, drawSlashFlash(x, y));
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

function createSkill(x: number, y: number, fast: boolean): EffectInstance {
  const ps: Particle[] = [];
  for (let i = 0; i < (fast ? 10 : 22); i++) {
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

function buffHealColor(
  bright: boolean,
  isHeal: boolean,
): [number, number, number, number, number, number] {
  if (isHeal) return [bright ? 255 : 240, bright ? 240 : 200, bright ? 180 : 60, 200, 160, 40];
  return [bright ? 100 : 40, bright ? 240 : 200, bright ? 150 : 100, 20, 160, 80];
}

function buffHealOverlay(x: number, y: number, isHeal: boolean): EffectInstance["drawOverlay"] {
  const [gr, gg, gb] = isHeal ? [240, 200, 60] : [40, 200, 100];
  return (ctx, progress) => {
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
}

function createBuffHeal(x: number, y: number, fast: boolean, isHeal: boolean): EffectInstance {
  const ps: Particle[] = [];
  for (let i = 0; i < (fast ? 7 : 16); i++) {
    const [r, g, b, re, ge, be] = buffHealColor(Math.random() < 0.2, isHeal);
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
  return makeInstance(
    isHeal ? "heal" : "buff",
    ps,
    fast ? 0.18 : 0.55,
    x,
    y,
    buffHealOverlay(x, y, isHeal),
  );
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

export { __resetNextId } from "./emit";
