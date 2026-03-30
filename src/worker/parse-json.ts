import type { Context, MiddlewareHandler } from "hono";
import { safeAsync, fromThrowable, err } from "../shared/errors";
import type { Result, GameError } from "../shared/errors";

const jsonErr = (): GameError => ({ type: "PRECONDITION_FAILED", reason: "invalid_json" });
const tooLargeErr = (): GameError => ({ type: "PRECONDITION_FAILED", reason: "payload_too_large" });

const PARSED_BODY_KEY = "parsedBody";
const DEFAULT_MAX_BYTES = 10_000;

export function bodyField(body: unknown, key: string): unknown {
  if (typeof body !== "object" || body === null) return null;
  return (body as Record<string, unknown>)[key] ?? null;
}

const parseJsonString = fromThrowable((s: string) => JSON.parse(s) as unknown, jsonErr);

function parseBody(raw: string, maxBytes: number): Result<unknown, GameError> {
  if (raw.length > maxBytes) return err(tooLargeErr());
  return parseJsonString(raw);
}

export function jsonBody(maxBytes = DEFAULT_MAX_BYTES): MiddlewareHandler {
  return async (c, next) => {
    const result = await safeAsync(() => c.req.text(), jsonErr).then((r) =>
      r.andThen((raw) => parseBody(raw, maxBytes)),
    );
    if (result.isErr()) return c.json({ error: result.error }, 400);
    c.set(PARSED_BODY_KEY, result.value);
    return next();
  };
}

export function getParsedBody(c: Context): unknown {
  return c.get(PARSED_BODY_KEY);
}
