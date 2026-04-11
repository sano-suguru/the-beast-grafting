import { test, expect } from "@playwright/test";

/**
 * Tailwind v4 @theme tokens are silently ignored when the CSS variable prefix
 * is wrong (e.g. --font-size-* instead of --text-*). This test catches that
 * regression by applying every custom utility class to a probe element and
 * asserting the computed style actually changes.
 */

interface TokenSpec {
  cls: string;
  prop: "fontSize" | "fontFamily" | "color" | "backgroundColor" | "borderColor";
  expected: string | RegExp;
}

const TOKENS: TokenSpec[] = [
  // ── Font sizes ──
  { cls: "text-card-sm", prop: "fontSize", expected: "8px" },
  { cls: "text-card-md", prop: "fontSize", expected: "9px" },
  { cls: "text-body-xs", prop: "fontSize", expected: "10px" },
  { cls: "text-body-sm", prop: "fontSize", expected: "11px" },

  // ── Font families ──
  { cls: "font-title", prop: "fontFamily", expected: /UnifrakturMaguntia/ },
  { cls: "font-body", prop: "fontFamily", expected: /system-ui|sans-serif/ },
  { cls: "font-serif", prop: "fontFamily", expected: /ui-serif|Georgia/ },
  { cls: "font-mono", prop: "fontFamily", expected: /ui-monospace|SFMono|monospace/ },

  // ── Colors (spot-check representative tokens) ──
  { cls: "text-parchment", prop: "color", expected: "rgb(212, 196, 160)" },
  { cls: "text-blood-bright", prop: "color", expected: "rgb(216, 72, 72)" },
  { cls: "text-disabled-fg", prop: "color", expected: "rgb(120, 120, 128)" },
  { cls: "text-gold-muted", prop: "color", expected: "rgb(160, 128, 64)" },
  { cls: "text-church-muted", prop: "color", expected: "rgb(168, 112, 56)" },
  { cls: "bg-void", prop: "backgroundColor", expected: "rgb(8, 7, 11)" },
  { cls: "border-iron", prop: "borderColor", expected: "rgb(58, 58, 62)" },
];

type ContrastTier = "aa-text" | "non-text" | "decorative" | "exempt";

interface ContrastSpec {
  token: string;
  tier: ContrastTier;
  minRatio: number;
}

const CONTRAST_TOKENS: ContrastSpec[] = [
  // ── AA text (≥ 4.7:1 margin target) ──
  { token: "--color-parchment", tier: "aa-text", minRatio: 4.7 },
  { token: "--color-parchment-dim", tier: "aa-text", minRatio: 4.7 },
  { token: "--color-parchment-bright", tier: "aa-text", minRatio: 4.7 },
  { token: "--color-parchment-muted", tier: "aa-text", minRatio: 4.7 },
  { token: "--color-blood-bright", tier: "aa-text", minRatio: 4.7 },
  { token: "--color-blood-muted", tier: "aa-text", minRatio: 4.7 },
  { token: "--color-rot", tier: "aa-text", minRatio: 4.7 },
  { token: "--color-rot-bright", tier: "aa-text", minRatio: 4.7 },
  { token: "--color-rot-acid", tier: "aa-text", minRatio: 4.7 },
  { token: "--color-tarnished-gold", tier: "aa-text", minRatio: 4.7 },
  { token: "--color-tarnished-gold-dim", tier: "aa-text", minRatio: 4.7 },
  { token: "--color-iron-light", tier: "aa-text", minRatio: 4.7 },
  { token: "--color-corpse-wax", tier: "aa-text", minRatio: 4.7 },
  { token: "--color-hex", tier: "aa-text", minRatio: 4.7 },
  { token: "--color-church", tier: "aa-text", minRatio: 4.7 },
  { token: "--color-church-dim", tier: "aa-text", minRatio: 4.7 },
  { token: "--color-church-muted", tier: "aa-text", minRatio: 4.7 },
  { token: "--color-church-lore", tier: "aa-text", minRatio: 4.7 },
  { token: "--color-gold-muted", tier: "aa-text", minRatio: 4.7 },
  { token: "--color-gold-stat-muted", tier: "aa-text", minRatio: 4.7 },

  // ── Non-text / icon (≥ 3.0:1 per WCAG 1.4.11) ──
  { token: "--color-blood-dim", tier: "non-text", minRatio: 3.0 },

  // ── Disabled controls (WCAG exempt — SC 1.4.3) ──
  { token: "--color-disabled-fg", tier: "exempt", minRatio: 0 },

  // ── Decorative (no minimum) ──
  { token: "--color-parchment-ghost", tier: "decorative", minRatio: 0 },
];

test.describe("theme tokens", () => {
  test("all custom @theme tokens generate working utility classes", async ({ page }) => {
    await page.goto("/");

    const failures = await page.evaluate((tokens) => {
      const el = document.createElement("div");
      document.body.appendChild(el);

      const baseStyles: Record<string, string> = {};
      for (const t of tokens) {
        baseStyles[t.prop] ??= getComputedStyle(el)[t.prop];
      }

      const bad: string[] = [];
      for (const t of tokens) {
        el.className = t.cls;
        const actual = getComputedStyle(el)[t.prop];
        if (actual === baseStyles[t.prop]) {
          bad.push(`${t.cls} → ${t.prop} did not change (still "${actual}")`);
        }
        el.className = "";
      }

      document.body.removeChild(el);
      return bad;
    }, TOKENS);

    expect(failures, "Broken tokens (class applied but no style change)").toEqual([]);
  });

  test("custom font-size tokens resolve to expected values", async ({ page }) => {
    await page.goto("/");

    const sizes = await page.evaluate(
      (tokens) => {
        const el = document.createElement("div");
        document.body.appendChild(el);
        const result: Record<string, string> = {};
        for (const t of tokens) {
          el.className = t.cls;
          result[t.cls] = getComputedStyle(el).fontSize;
          el.className = "";
        }
        document.body.removeChild(el);
        return result;
      },
      TOKENS.filter((t) => t.prop === "fontSize"),
    );

    for (const t of TOKENS.filter((t) => t.prop === "fontSize")) {
      expect(sizes[t.cls], `${t.cls}`).toBe(t.expected);
    }
  });

  test("custom font-family tokens resolve to expected values", async ({ page }) => {
    await page.goto("/");

    const families = await page.evaluate(
      (tokens) => {
        const el = document.createElement("div");
        document.body.appendChild(el);
        const result: Record<string, string> = {};
        for (const t of tokens) {
          el.className = t.cls;
          result[t.cls] = getComputedStyle(el).fontFamily;
          el.className = "";
        }
        document.body.removeChild(el);
        return result;
      },
      TOKENS.filter((t) => t.prop === "fontFamily"),
    );

    for (const t of TOKENS.filter((t) => t.prop === "fontFamily")) {
      expect(families[t.cls], `${t.cls}`).toMatch(t.expected);
    }
  });

  test("color tokens meet WCAG contrast requirements against void background", async ({ page }) => {
    await page.goto("/");

    const failures = await page.evaluate((specs) => {
      function parseRgb(raw: string): [number, number, number] {
        const m = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
      }

      function luminance([r, g, b]: [number, number, number]): number {
        const [rs, gs, bs] = [r, g, b].map((c) => {
          const s = c / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      }

      function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
        const l1 = luminance(fg);
        const l2 = luminance(bg);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      }

      const el = document.createElement("div");
      document.body.appendChild(el);

      el.style.color = "var(--color-void)";
      const bgRgb = parseRgb(getComputedStyle(el).color);

      const bad: string[] = [];
      for (const spec of specs) {
        if (spec.minRatio <= 0) continue;
        el.style.color = `var(${spec.token})`;
        const fgRgb = parseRgb(getComputedStyle(el).color);
        const ratio = contrastRatio(fgRgb, bgRgb);
        if (ratio < spec.minRatio) {
          bad.push(`${spec.token} (${spec.tier}): ${ratio.toFixed(2)}:1 < ${spec.minRatio}:1`);
        }
      }

      document.body.removeChild(el);
      return bad;
    }, CONTRAST_TOKENS);

    expect(failures, "Tokens failing WCAG contrast requirements").toEqual([]);
  });
});
