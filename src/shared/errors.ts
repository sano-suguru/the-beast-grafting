import { err, ok, fromThrowable } from "neverthrow";
import type { Result } from "neverthrow";

export type GameError =
  | { type: "INSUFFICIENT_RESOURCE"; resource: string; minimum: number; current: number }
  | { type: "INVALID_TARGET"; reason: string }
  | { type: "INVALID_INDEX"; index: number }
  | { type: "PRECONDITION_FAILED"; reason: string }
  | { type: "NOT_FOUND"; entity: string }
  | { type: "AUTH_INVALID_CREDENTIALS" }
  | { type: "AUTH_EMAIL_TAKEN" }
  | { type: "CONFLICT"; reason: string };

export type InfraError =
  | { type: "AUDIO_INIT_FAILED"; cause: unknown }
  | { type: "AUDIO_PLAY_FAILED"; cause: unknown }
  | { type: "STORAGE_PARSE_FAILED"; cause: unknown }
  | { type: "STORAGE_READ_FAILED"; cause: unknown }
  | { type: "STORAGE_WRITE_FAILED"; cause: unknown }
  | { type: "DB_ERROR"; cause: unknown }
  | { type: "AUTH_OAUTH_FAILED"; cause: unknown }
  | { type: "CRYPTO_FAILED"; cause: unknown }
  | { type: "API_FETCH_FAILED"; status: number; cause: unknown };

export const dbErr = (e: unknown): InfraError => ({ type: "DB_ERROR", cause: e });
export const fetchErr = (e: unknown): InfraError => ({
  type: "API_FETCH_FAILED",
  status: 0,
  cause: e,
});

/** fromThrowable for async — wraps a promise, catches rejections into Result */
function safeAsync<T, E>(fn: () => Promise<T>, mapErr: (e: unknown) => E): Promise<Result<T, E>> {
  return fn().then(
    (value) => ok(value),
    (error) => err(mapErr(error)),
  );
}

export { err, ok, fromThrowable, safeAsync };
export type { Result };
