import type { Particle } from "./types";
import { acquire, release, finalize, __clearPool } from "./pool";

beforeEach(() => {
  __clearPool();
});

describe("acquire / release", () => {
  it("returns fresh particle when pool is empty", () => {
    const p = acquire();
    expect(p.x).toBe(0);
    expect(p.shape).toBe("circle");
  });

  it("reuses released particle", () => {
    const p1 = acquire();
    p1.x = 42;
    release(p1);
    const p2 = acquire();
    expect(p2).toBe(p1);
    expect(p2.x).toBe(42);
  });
});

describe("finalize", () => {
  it("sets maxLife equal to life", () => {
    const p = acquire();
    p.life = 0.5;
    const into: Particle[] = [];
    finalize(p, into);
    expect(p.maxLife).toBe(0.5);
  });

  it("resets lineEnd for circle shape", () => {
    const p = acquire();
    p.shape = "circle";
    p.lineEndX = 10;
    p.lineEndY = 20;
    const into: Particle[] = [];
    finalize(p, into);
    expect(p.lineEndX).toBe(0);
    expect(p.lineEndY).toBe(0);
  });

  it("resets lineEnd for rect shape", () => {
    const p = acquire();
    p.shape = "rect";
    p.lineEndX = 10;
    p.lineEndY = 20;
    const into: Particle[] = [];
    finalize(p, into);
    expect(p.lineEndX).toBe(0);
    expect(p.lineEndY).toBe(0);
  });

  it("applies shape override", () => {
    const p = acquire();
    const into: Particle[] = [];
    finalize(p, into, { shape: "line" });
    expect(p.shape).toBe("line");
  });

  it("applies composite override", () => {
    const p = acquire();
    const into: Particle[] = [];
    finalize(p, into, { composite: "lighter" });
    expect(p.composite).toBe("lighter");
  });

  it("applies seed and wobble overrides", () => {
    const p = acquire();
    const into: Particle[] = [];
    finalize(p, into, { seed: 42, wobble: true });
    expect(p.seed).toBe(42);
    expect(p.wobble).toBe(true);
  });

  it("pushes particle into target array", () => {
    const p = acquire();
    const into: Particle[] = [];
    finalize(p, into);
    expect(into).toHaveLength(1);
    expect(into[0]).toBe(p);
  });
});
