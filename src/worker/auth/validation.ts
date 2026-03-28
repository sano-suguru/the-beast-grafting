import { ok, err } from "../../shared/errors";
import type { Result, GameError } from "../../shared/errors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export function validateEmail(input: unknown): Result<string, GameError> {
  if (typeof input !== "string")
    return err({ type: "PRECONDITION_FAILED", reason: "email_must_be_string" });
  const normalized = input.trim().toLowerCase();
  if (normalized.length > MAX_EMAIL_LENGTH)
    return err({ type: "PRECONDITION_FAILED", reason: "email_too_long" });
  if (!EMAIL_RE.test(normalized))
    return err({ type: "PRECONDITION_FAILED", reason: "invalid_email_format" });
  return ok(normalized);
}

export function validatePassword(input: unknown): Result<string, GameError> {
  if (typeof input !== "string")
    return err({ type: "PRECONDITION_FAILED", reason: "password_must_be_string" });
  if (input.length < MIN_PASSWORD_LENGTH)
    return err({ type: "PRECONDITION_FAILED", reason: "password_too_short" });
  if (input.length > MAX_PASSWORD_LENGTH)
    return err({ type: "PRECONDITION_FAILED", reason: "password_too_long" });
  return ok(input);
}
