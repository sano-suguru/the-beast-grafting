import type { SoundType, SoundResult } from "../types";
import { fromThrowable } from "../../shared/errors";
import type { InfraError } from "../../shared/errors";
import { warn } from "../../shared/logger";

let audioCtx: AudioContext | null = null;

const safeInitAudio = fromThrowable(
  () => {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
  },
  (e): InfraError => ({ type: "AUDIO_INIT_FAILED", cause: e }),
);

/** Web Audio APIの制約上、ユーザージェスチャー内でのみresume可能。各クリックハンドラから呼ぶ設計 */
export const initAudio = (): void => {
  safeInitAudio().mapErr((e) => warn("Audio Context initialization failed", e));
};

interface SoundConfig {
  wave: OscillatorType;
  freqStart: number;
  freqEnd: number;
  duration: number;
  gainStart: number;
  gainEnd?: number;
}

const SOUNDS: Record<string, SoundConfig> = {
  select: { wave: "sine", freqStart: 600, freqEnd: 200, duration: 0.05, gainStart: 0.1 },
  error: { wave: "square", freqStart: 150, freqEnd: 150, duration: 0.15, gainStart: 0.1 },
  buy: { wave: "sawtooth", freqStart: 100, freqEnd: 40, duration: 0.15, gainStart: 0.2 },
  clash: { wave: "square", freqStart: 120, freqEnd: 40, duration: 0.1, gainStart: 0.3 },
  damage: { wave: "sawtooth", freqStart: 800, freqEnd: 100, duration: 0.1, gainStart: 0.15 },
  defend: { wave: "triangle", freqStart: 1200, freqEnd: 400, duration: 0.1, gainStart: 0.2 },
  death: { wave: "sawtooth", freqStart: 80, freqEnd: 10, duration: 0.3, gainStart: 0.3 },
  tier_unlock: { wave: "triangle", freqStart: 150, freqEnd: 600, duration: 0.3, gainStart: 0.25 },
};

function createOscGain(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
  return { osc, gain, now: ctx.currentTime };
}

function playSimple(ctx: AudioContext, config: SoundConfig) {
  const { osc, gain, now } = createOscGain(ctx);
  osc.type = config.wave;
  osc.frequency.setValueAtTime(config.freqStart, now);
  osc.frequency.exponentialRampToValueAtTime(config.freqEnd, now + config.duration);
  gain.gain.setValueAtTime(config.gainStart, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + config.duration);
  osc.start(now);
  osc.stop(now + config.duration);
}

function playGraft(ctx: AudioContext) {
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  osc1.type = "triangle";
  osc1.frequency.setValueAtTime(80, now);
  osc1.frequency.exponentialRampToValueAtTime(20, now + 0.25);
  osc1.connect(gain);

  const osc2 = ctx.createOscillator();
  osc2.type = "square";
  osc2.frequency.setValueAtTime(120, now);
  osc2.frequency.exponentialRampToValueAtTime(30, now + 0.25);
  osc2.connect(gain);

  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

  osc1.onended = () => {
    osc1.disconnect();
    osc2.disconnect();
    gain.disconnect();
  };
  osc1.start(now);
  osc1.stop(now + 0.25);
  osc2.start(now);
  osc2.stop(now + 0.25);
}

function playSkill(ctx: AudioContext) {
  const { osc, gain, now } = createOscGain(ctx);
  osc.type = "sine";
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.setValueAtTime(800, now + 0.05);
  osc.frequency.setValueAtTime(1200, now + 0.1);
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
  osc.start(now);
  osc.stop(now + 0.3);
}

export const playSE = (type: SoundType): void => {
  if (!audioCtx || audioCtx.state === "suspended") return;
  const safePlay = fromThrowable(
    () => {
      if (type === "graft") return playGraft(audioCtx!);
      if (type === "skill") return playSkill(audioCtx!);
      const config = SOUNDS[type];
      if (config) playSimple(audioCtx!, config);
    },
    (e): InfraError => ({ type: "AUDIO_PLAY_FAILED", cause: e }),
  );
  safePlay().mapErr((e) => warn("Failed to play SE", e));
};

export function playSEFrom(result: SoundResult): void {
  void result.then((se) => {
    if (se) playSE(se);
  });
}
