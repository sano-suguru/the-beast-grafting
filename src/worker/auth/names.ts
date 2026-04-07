import { toHex } from "./crypto";
import { GUEST_NAME_PREFIX } from "../../shared/guest-name";

export function generateGuestName(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(2));
  return `${GUEST_NAME_PREFIX}${toHex(bytes).toUpperCase()}`;
}

export const MAX_DISPLAY_NAME_LENGTH = 20;

/** ASCII制御文字 (C0, DEL, C1) + BiDi制御文字 */
const UNSAFE_CODEPOINTS = new Set([0x061c, 0xfeff]);
const UNSAFE_RANGES: [number, number][] = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0x200e, 0x200f],
  [0x202a, 0x202e],
  [0x2066, 0x2069],
];

function isUnsafeChar(code: number): boolean {
  if (UNSAFE_CODEPOINTS.has(code)) return true;
  return UNSAFE_RANGES.some(([lo, hi]) => code >= lo && code <= hi);
}

export function stripControlChars(raw: string): string {
  return Array.from(raw)
    .filter((ch) => !isUnsafeChar(ch.codePointAt(0)!))
    .join("");
}
