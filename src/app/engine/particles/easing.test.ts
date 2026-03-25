import { lerp, easeOutQuad, easeOutCubic, easeInCubic, clamp01 } from "./easing";

describe("lerp", () => {
  it("returns start at t=0", () => {
    expect(lerp(0, 10, 0)).toBe(0);
  });
  it("returns end at t=1", () => {
    expect(lerp(0, 10, 1)).toBe(10);
  });
  it("returns midpoint at t=0.5", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
  it("works with negative ranges", () => {
    expect(lerp(-10, 10, 0.5)).toBe(0);
  });
});

describe("easeOutQuad", () => {
  it("returns 0 at t=0", () => {
    expect(easeOutQuad(0)).toBe(0);
  });
  it("returns 1 at t=1", () => {
    expect(easeOutQuad(1)).toBe(1);
  });
  it("returns 0.75 at t=0.5", () => {
    expect(easeOutQuad(0.5)).toBe(0.75);
  });
});

describe("easeOutCubic", () => {
  it("returns 0 at t=0", () => {
    expect(easeOutCubic(0)).toBe(0);
  });
  it("returns 1 at t=1", () => {
    expect(easeOutCubic(1)).toBe(1);
  });
  it("returns 0.875 at t=0.5", () => {
    expect(easeOutCubic(0.5)).toBe(0.875);
  });
});

describe("easeInCubic", () => {
  it("returns 0 at t=0", () => {
    expect(easeInCubic(0)).toBe(0);
  });
  it("returns 1 at t=1", () => {
    expect(easeInCubic(1)).toBe(1);
  });
  it("returns 0.125 at t=0.5", () => {
    expect(easeInCubic(0.5)).toBe(0.125);
  });
});

describe("clamp01", () => {
  it("clamps negative to 0", () => {
    expect(clamp01(-0.5)).toBe(0);
  });
  it("clamps above 1 to 1", () => {
    expect(clamp01(1.5)).toBe(1);
  });
  it("passes through values in range", () => {
    expect(clamp01(0.5)).toBe(0.5);
  });
  it("returns 0 for exactly 0", () => {
    expect(clamp01(0)).toBe(0);
  });
  it("returns 1 for exactly 1", () => {
    expect(clamp01(1)).toBe(1);
  });
});
