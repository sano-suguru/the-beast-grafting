import { fromThrowable } from "./errors";
import { warn } from "./logger";

const _safeSetItem = fromThrowable(
  (key: string, value: string) => {
    localStorage.setItem(key, value);
  },
  (e): { type: "STORAGE_WRITE_FAILED"; cause: unknown } => ({
    type: "STORAGE_WRITE_FAILED",
    cause: e,
  }),
);

export function safeSetItem(key: string, value: string): void {
  _safeSetItem(key, value).mapErr((e) => warn(`[storage] write failed: ${key}`, e.cause));
}

const _safeGetItem = fromThrowable(
  (key: string): string | null => localStorage.getItem(key),
  (e): { type: "STORAGE_READ_FAILED"; cause: unknown } => ({
    type: "STORAGE_READ_FAILED",
    cause: e,
  }),
);

export function safeGetItem(key: string): string | null {
  return _safeGetItem(key)
    .mapErr((e) => warn(`[storage] read failed: ${key}`, e.cause))
    .unwrapOr(null);
}
