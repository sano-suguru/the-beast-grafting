import { err, ok, fromThrowable } from "neverthrow";
import type { Result } from "neverthrow";

export type GameError =
  | { type: "INSUFFICIENT_RESOURCE"; resource: string; required: number; current: number }
  | { type: "INVALID_TARGET"; reason: string }
  | { type: "INVALID_INDEX"; index: number }
  | { type: "PRECONDITION_FAILED"; reason: string }
  | { type: "NOT_FOUND"; entity: string };

export type InfraError =
  | { type: "AUDIO_INIT_FAILED"; cause: unknown }
  | { type: "AUDIO_PLAY_FAILED"; cause: unknown }
  | { type: "STORAGE_PARSE_FAILED"; cause: unknown }
  | { type: "STORAGE_READ_FAILED"; cause: unknown }
  | { type: "STORAGE_WRITE_FAILED"; cause: unknown }
  | { type: "DB_ERROR"; cause: unknown };

export { err, ok, fromThrowable };
export type { Result };
