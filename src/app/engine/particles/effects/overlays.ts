import type { EffectInstance } from "../types";
import { clamp01, easeOutQuad, easeOutCubic, easeInCubic } from "../easing";

export function drawSlashFlash(ox: number, oy: number): EffectInstance["drawOverlay"] {
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

export function drawShockwave(ox: number, oy: number): EffectInstance["drawOverlay"] {
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
    drawInnerRing(ctx, ox, oy, progress);
    drawRadialLines(ctx, ox, oy, progress);
  };
}

function drawInnerRing(ctx: CanvasRenderingContext2D, ox: number, oy: number, progress: number) {
  const innerT = clamp01((progress - 0.12) / 0.88);
  if (innerT <= 0) return;
  ctx.globalAlpha = clamp01(1 - innerT) * 0.5;
  ctx.strokeStyle = "rgb(200,180,160)";
  ctx.lineWidth = 2 * (1 - innerT);
  ctx.beginPath();
  ctx.arc(ox, oy, easeOutQuad(innerT) * 50, 0, Math.PI * 2);
  ctx.stroke();
}

function drawRadialLines(ctx: CanvasRenderingContext2D, ox: number, oy: number, progress: number) {
  if (progress >= 0.7) return;
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

export function drawRuneCircle(ox: number, oy: number): EffectInstance["drawOverlay"] {
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

export function drawRift(ox: number, oy: number): EffectInstance["drawOverlay"] {
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

export function drawSoulRing(ox: number, oy: number): EffectInstance["drawOverlay"] {
  return (ctx, progress) => {
    const outerR = easeOutQuad(progress) * 30;
    const fade = clamp01(1 - progress);
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "rgba(160,180,230,0.4)";
    ctx.globalAlpha = fade * 0.4;
    ctx.strokeStyle = "rgb(160,180,230)";
    ctx.lineWidth = 1.5 - progress * 0.7;
    ctx.beginPath();
    ctx.arc(ox, oy, outerR, 0, Math.PI * 2);
    ctx.stroke();
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
