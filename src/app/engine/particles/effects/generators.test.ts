import { createEffect, __resetNextId } from "./generators";
import { __clearPool } from "../pool";

const EFFECT_TYPES = ["damage", "clash", "skill", "summon", "death", "buff", "heal"] as const;

describe("createEffect", () => {
  beforeEach(() => {
    __resetNextId();
    __clearPool();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- 基本動作 ---

  it("未知の type には null を返す", () => {
    expect(createEffect("unknown", 0, 0, { fast: false })).toBeNull();
  });

  it("有効な type では EffectInstance を返す", () => {
    const effect = createEffect("damage", 0, 0, { fast: false });
    expect(effect).not.toBeNull();
    expect(effect?.type).toBe("damage");
  });

  it("originX/originY が引数通り", () => {
    const effect = createEffect("damage", 42, 99, { fast: false });
    expect(effect?.originX).toBe(42);
    expect(effect?.originY).toBe(99);
  });

  it("ID が呼び出しごとにインクリメントされる", () => {
    const e1 = createEffect("damage", 0, 0, { fast: false });
    const e2 = createEffect("clash", 0, 0, { fast: false });
    const e3 = createEffect("skill", 0, 0, { fast: false });
    expect(e1?.id).toBe(0);
    expect(e2?.id).toBe(1);
    expect(e3?.id).toBe(2);
  });

  // --- fast フラグ ---

  it("fast=true は fast=false より duration が短い", () => {
    const slow = createEffect("damage", 0, 0, { fast: false });
    const fast = createEffect("damage", 0, 0, { fast: true });
    expect(fast!.duration).toBeLessThan(slow!.duration);
  });

  it("fast=true は fast=false よりパーティクル数が少ない", () => {
    const slow = createEffect("damage", 0, 0, { fast: false });
    const fast = createEffect("damage", 0, 0, { fast: true });
    expect(fast!.particles.length).toBeLessThan(slow!.particles.length);
  });

  // --- 各エフェクトタイプ ---

  it.each(EFFECT_TYPES)("%s: パーティクルが生成され duration が正", (type) => {
    const effect = createEffect(type, 10, 20, { fast: false });
    expect(effect).not.toBeNull();
    expect(effect!.particles.length).toBeGreaterThan(0);
    expect(effect!.duration).toBeGreaterThan(0);
  });

  // --- drawOverlay ---

  it.each(EFFECT_TYPES)("%s: drawOverlay が存在する", (type) => {
    const effect = createEffect(type, 0, 0, { fast: false });
    expect(effect?.drawOverlay).toBeTypeOf("function");
  });

  // --- パーティクルプロパティの妥当性 ---

  it.each(EFFECT_TYPES)("%s: 全パーティクルの life > 0", (type) => {
    const effect = createEffect(type, 0, 0, { fast: false });
    for (const p of effect!.particles) {
      expect(p.life).toBeGreaterThan(0);
    }
  });

  it.each(EFFECT_TYPES)("%s: 全パーティクルの maxLife === life（初期状態）", (type) => {
    const effect = createEffect(type, 0, 0, { fast: false });
    for (const p of effect!.particles) {
      expect(p.maxLife).toBe(p.life);
    }
  });

  it("damage のパーティクルに line シェイプが含まれる（斬撃線）", () => {
    const effect = createEffect("damage", 0, 0, { fast: false });
    const hasLine = effect!.particles.some((p) => p.shape === "line");
    expect(hasLine).toBe(true);
  });

  it("clash のパーティクルは rect シェイプ", () => {
    const effect = createEffect("clash", 0, 0, { fast: false });
    const allRect = effect!.particles.every((p) => p.shape === "rect");
    expect(allRect).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// drawOverlay 振る舞いテスト（Canvas mock）
// ---------------------------------------------------------------------------

interface MockCtx {
  ctx: CanvasRenderingContext2D;
  beginPath: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  quadraticCurveTo: ReturnType<typeof vi.fn>;
}

function mockCtx(): MockCtx {
  const beginPath = vi.fn();
  const moveTo = vi.fn();
  const lineTo = vi.fn();
  const arc = vi.fn();
  const stroke = vi.fn();
  const fill = vi.fn();
  const quadraticCurveTo = vi.fn();
  const ctx = {
    globalCompositeOperation: "source-over",
    globalAlpha: 1,
    shadowBlur: 0,
    shadowColor: "",
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    beginPath,
    moveTo,
    lineTo,
    arc,
    stroke,
    fill,
    quadraticCurveTo,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, beginPath, moveTo, lineTo, arc, stroke, fill, quadraticCurveTo };
}

describe("drawOverlay behaviour", () => {
  beforeEach(() => {
    __resetNextId();
    __clearPool();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- damage: drawSlashFlash ---

  it("damage overlay does not draw when progress > 0.4", () => {
    const effect = createEffect("damage", 50, 50, { fast: false })!;
    const m = mockCtx();
    effect.drawOverlay!(m.ctx, 0.5, 0.5);
    expect(m.stroke).not.toHaveBeenCalled();
  });

  it("damage overlay draws when progress < 0.4", () => {
    const effect = createEffect("damage", 50, 50, { fast: false })!;
    const m = mockCtx();
    effect.drawOverlay!(m.ctx, 0.2, 0.2);
    expect(m.stroke).toHaveBeenCalled();
  });

  // --- clash: drawShockwave ---

  it("clash overlay draws shockwave ring", () => {
    const effect = createEffect("clash", 50, 50, { fast: false })!;
    const m = mockCtx();
    effect.drawOverlay!(m.ctx, 0.5, 0.5);
    expect(m.arc).toHaveBeenCalled();
    expect(m.stroke).toHaveBeenCalled();
  });

  // --- skill: drawRuneCircle ---

  it("skill overlay draws rune circle", () => {
    const effect = createEffect("skill", 50, 50, { fast: false })!;
    const m = mockCtx();
    effect.drawOverlay!(m.ctx, 0.5, 1.0);
    expect(m.arc).toHaveBeenCalled();
  });

  // --- summon: drawRift ---

  it("summon overlay does not draw when rift is fully closed", () => {
    const effect = createEffect("summon", 50, 50, { fast: false })!;
    const m = mockCtx();
    effect.drawOverlay!(m.ctx, 1.0, 1.0);
    expect(m.stroke).not.toHaveBeenCalled();
  });

  it("summon overlay draws when rift is open", () => {
    const effect = createEffect("summon", 50, 50, { fast: false })!;
    const m = mockCtx();
    effect.drawOverlay!(m.ctx, 0.5, 0.5);
    expect(m.stroke).toHaveBeenCalled();
  });

  // --- death: drawSoulRing ---

  it("death overlay draws expanding ring", () => {
    const effect = createEffect("death", 50, 50, { fast: false })!;
    const m = mockCtx();
    effect.drawOverlay!(m.ctx, 0.5, 0.5);
    expect(m.arc).toHaveBeenCalled();
    expect(m.stroke).toHaveBeenCalled();
  });

  // --- buff/heal inline overlay ---

  it("buff overlay does not draw when radius < 0.5", () => {
    const effect = createEffect("buff", 50, 50, { fast: false })!;
    const m = mockCtx();
    effect.drawOverlay!(m.ctx, 0.99, 0.99);
    expect(m.fill).not.toHaveBeenCalled();
  });

  it("buff overlay draws when progress is in growth phase", () => {
    const effect = createEffect("buff", 50, 50, { fast: false })!;
    const m = mockCtx();
    effect.drawOverlay!(m.ctx, 0.15, 0.15);
    expect(m.fill).toHaveBeenCalled();
    expect(m.arc).toHaveBeenCalled();
  });

  it("heal overlay draws when progress is in growth phase", () => {
    const effect = createEffect("heal", 50, 50, { fast: false })!;
    const m = mockCtx();
    effect.drawOverlay!(m.ctx, 0.15, 0.15);
    expect(m.fill).toHaveBeenCalled();
    expect(m.arc).toHaveBeenCalled();
  });

  it("heal overlay does not draw when radius < 0.5", () => {
    const effect = createEffect("heal", 50, 50, { fast: false })!;
    const m = mockCtx();
    effect.drawOverlay!(m.ctx, 0.99, 0.99);
    expect(m.fill).not.toHaveBeenCalled();
  });
});
