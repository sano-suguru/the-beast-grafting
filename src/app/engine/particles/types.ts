export type ParticleShape = "circle" | "rect" | "line";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  size: number;
  sizeEnd: number;
  r: number;
  g: number;
  b: number;
  a: number;
  rEnd: number;
  gEnd: number;
  bEnd: number;
  aEnd: number;
  life: number;
  maxLife: number;
  rotation: number;
  rotationSpeed: number;
  shape: ParticleShape;
  composite: GlobalCompositeOperation;
  /** line 形状用: 終点オフセット */
  lineEndX: number;
  lineEndY: number;
  lineWidth: number;
  /** sin 揺れ用シード */
  seed: number;
  /** sin 揺れを適用するか */
  wobble: boolean;
}

export interface EffectInstance {
  id: number;
  type: string;
  particles: Particle[];
  /** 非パーティクル描画（呪文陣、衝撃波リング等）。
   *  呼び出し元が ctx.save()/restore() で囲むため、実装側での save/restore は不要。
   *  globalCompositeOperation, globalAlpha, transform 等を自由に変更してよい。 */
  drawOverlay?: (ctx: CanvasRenderingContext2D, progress: number, elapsed: number) => void;
  elapsed: number;
  duration: number;
  originX: number;
  originY: number;
}
