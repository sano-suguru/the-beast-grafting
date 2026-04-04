import type { EffectInstance, Particle } from "./types";
import { acquire, finalize } from "./pool";
import { updateEffects, pruneEffects, enforceLimit, interpolated } from "./update";

function makeParticle(overrides: Partial<Particle> = {}): Particle {
  const p = acquire();
  p.x = 0;
  p.y = 0;
  p.vx = 0;
  p.vy = 0;
  p.ax = 0;
  p.ay = 0;
  p.size = 2;
  p.sizeEnd = 0;
  p.r = 255;
  p.g = 255;
  p.b = 255;
  p.a = 1;
  p.rEnd = 0;
  p.gEnd = 0;
  p.bEnd = 0;
  p.life = 1;
  Object.assign(p, overrides);
  finalize(p, []);
  return p;
}

function makeEffect(
  particles: Particle[],
  overrides: Partial<EffectInstance> = {},
): EffectInstance {
  return {
    id: 0,
    type: "test",
    particles,
    elapsed: 0,
    duration: 1,
    originX: 0,
    originY: 0,
    ...overrides,
  };
}

describe("updateEffects", () => {
  it("updates position by velocity * dt", () => {
    const p = makeParticle({ vx: 100, vy: -50 });
    const effects = [makeEffect([p])];
    updateEffects(effects, 0.1);
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(-5);
  });

  it("updates velocity by acceleration * dt", () => {
    const p = makeParticle({ ax: 200, ay: -100 });
    const effects = [makeEffect([p])];
    updateEffects(effects, 0.1);
    expect(p.vx).toBeCloseTo(20);
    expect(p.vy).toBeCloseTo(-10);
  });

  it("removes particles with life <= 0", () => {
    const p = makeParticle({ life: 0.05 });
    const effects = [makeEffect([p])];
    updateEffects(effects, 0.1);
    expect(effects[0]!.particles).toHaveLength(0);
  });

  it("decrements life by dt", () => {
    const p = makeParticle({ life: 1 });
    const effects = [makeEffect([p])];
    updateEffects(effects, 0.3);
    expect(p.life).toBeCloseTo(0.7);
  });

  it("increments effect elapsed by dt", () => {
    const effects = [makeEffect([])];
    updateEffects(effects, 0.25);
    expect(effects[0]!.elapsed).toBeCloseTo(0.25);
  });

  it("applies wobble to vx when wobble is true", () => {
    const p = makeParticle({ life: 1, seed: 1.5, wobble: true });
    const effects = [makeEffect([p])];
    updateEffects(effects, 0.01);
    const expectedLife = 1 - 0.01;
    const expected = Math.sin(expectedLife * 8 + 1.5) * 15;
    expect(p.vx).toBeCloseTo(expected);
  });

  it("does not apply wobble when wobble is false", () => {
    const p = makeParticle({ vx: 42, seed: 1.5, wobble: false });
    const effects = [makeEffect([p])];
    updateEffects(effects, 0.01);
    // vx should only have acceleration applied (ax=0), not wobble
    expect(p.vx).toBeCloseTo(42);
  });
});

describe("pruneEffects", () => {
  it("removes effects that exceeded duration with no particles", () => {
    const e = makeEffect([], { elapsed: 2, duration: 1 });
    const result = pruneEffects([e]);
    expect(result).toHaveLength(0);
  });

  it("keeps effects with remaining particles even if elapsed >= duration", () => {
    const p = makeParticle();
    const e = makeEffect([p], { elapsed: 2, duration: 1 });
    const result = pruneEffects([e]);
    expect(result).toHaveLength(1);
  });

  it("keeps effects with elapsed < duration", () => {
    const e = makeEffect([], { elapsed: 0.5, duration: 1 });
    const result = pruneEffects([e]);
    expect(result).toHaveLength(1);
  });
});

describe("enforceLimit", () => {
  it("does nothing when total particles <= 200", () => {
    const particles = Array.from({ length: 10 }, () => makeParticle({ life: 0.5 }));
    const effects = [makeEffect(particles)];
    enforceLimit(effects);
    expect(effects[0]!.particles.every((p) => p.life > 0)).toBe(true);
  });

  it("marks lowest-life particles for removal when over limit", () => {
    const particles: ReturnType<typeof makeParticle>[] = [];
    for (let i = 0; i < 210; i++) particles.push(makeParticle({ life: i + 1 }));
    const effects = [makeEffect(particles)];
    enforceLimit(effects);
    const killed = particles.filter((p) => p.life === 0);
    expect(killed).toHaveLength(10);
  });
});

describe("interpolated", () => {
  it("returns start values at beginning of life", () => {
    const p = makeParticle({ r: 200, g: 100, b: 50, a: 1, size: 4, rEnd: 0, gEnd: 0, bEnd: 0 });
    p.life = p.maxLife; // raw = 0
    const result = interpolated(p);
    expect(result.r).toBeCloseTo(200);
    expect(result.g).toBeCloseTo(100);
    expect(result.b).toBeCloseTo(50);
    expect(result.a).toBeCloseTo(1);
    expect(result.size).toBeCloseTo(4);
  });

  it("returns end values at end of life", () => {
    const p = makeParticle({
      r: 200,
      g: 100,
      b: 50,
      a: 1,
      size: 4,
      rEnd: 0,
      gEnd: 0,
      bEnd: 0,
      sizeEnd: 0,
    });
    p.life = 0.001; // raw ≈ 1
    const result = interpolated(p);
    expect(result.r).toBeCloseTo(0, 0);
    expect(result.a).toBeCloseTo(0, 1);
    expect(result.size).toBeCloseTo(0, 0);
  });

  it("returns zeros during delay period (raw < 0)", () => {
    const p = makeParticle({ life: 1 });
    // delay をシミュレート: maxLife=1 のまま life を手動で増やす
    p.life = 1.5;
    const result = interpolated(p);
    expect(result.r).toBe(0);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
    expect(result.a).toBe(0);
    expect(result.size).toBe(0);
  });
});
