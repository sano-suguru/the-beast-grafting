import { toHex } from "./crypto";

export const GUEST_NAME_PREFIX = "名もなき術師#";

export function generateGuestName(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(2));
  return `${GUEST_NAME_PREFIX}${toHex(bytes).toUpperCase()}`;
}

const MAX_DISPLAY_NAME_LENGTH = 20;

function isControlChar(code: number): boolean {
  return (code >= 0 && code <= 0x1f) || (code >= 0x7f && code <= 0x9f);
}

export function emailLocalToDisplayName(email: string): string {
  const local = email.split("@")[0]!;
  const stripped = local.split("+")[0]!;
  return sanitizeDisplayName(stripped || local);
}

export function sanitizeDisplayName(raw: string): string {
  const cleaned = Array.from(raw)
    .filter((ch) => !isControlChar(ch.codePointAt(0)!))
    .join("");
  if (cleaned.length === 0) return "User";
  if (cleaned.length > MAX_DISPLAY_NAME_LENGTH)
    return Array.from(cleaned).slice(0, MAX_DISPLAY_NAME_LENGTH).join("");
  return cleaned;
}
