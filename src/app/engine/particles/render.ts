import { clamp01 } from "./easing";
import type { EffectInstance } from "./types";
import { interpolated } from "./update";

/** 全エフェクトを Canvas に描画する */
export function renderEffects(ctx: CanvasRenderingContext2D, effects: EffectInstance[]): void {
  for (const effect of effects) {
    // パーティクル描画
    for (const p of effect.particles) {
      const { r, g, b, a, size } = interpolated(p);
      if (a <= 0 || size <= 0) continue;

      ctx.save();
      ctx.globalCompositeOperation = p.composite;
      ctx.globalAlpha = a;

      if (p.shape === "circle") {
        if (p.composite === "lighter" || p.composite === "screen") {
          ctx.shadowBlur = size * 2;
          ctx.shadowColor = `rgba(${r | 0},${g | 0},${b | 0},${(a * 0.5).toFixed(2)})`;
          ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${(a * 0.8).toFixed(2)})`;
        } else {
          ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === "rect") {
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-size, -size, size * 2, size * 2);
        ctx.restore();
      } else if (p.shape === "line") {
        ctx.shadowBlur = 4;
        ctx.shadowColor = `rgba(${r | 0},${g | 0},${b | 0},${(a * 0.4).toFixed(2)})`;
        ctx.strokeStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.lineWidth = p.lineWidth;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.lineEndX, p.y + p.lineEndY);
        ctx.stroke();
      }

      ctx.restore();
    }

    // オーバーレイ描画
    if (effect.drawOverlay && effect.elapsed < effect.duration) {
      const progress = clamp01(effect.elapsed / effect.duration);
      ctx.save();
      effect.drawOverlay(ctx, progress, effect.elapsed);
      ctx.restore();
    }
  }
}
