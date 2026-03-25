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
