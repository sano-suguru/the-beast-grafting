import type { SoundResult } from "./types";

export const NO_SOUND: SoundResult = Promise.resolve(null);
export const SE_SELECT: SoundResult = Promise.resolve("select");
export const SE_ERROR: SoundResult = Promise.resolve("error");
