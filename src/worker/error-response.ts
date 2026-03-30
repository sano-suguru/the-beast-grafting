import { error as logError } from "../shared/logger";
import type { Context } from "hono";

export function internalError(c: Context, label: string, cause: unknown) {
  logError(label, cause);
  return c.json({ error: { type: "INTERNAL_ERROR" } }, 500);
}
