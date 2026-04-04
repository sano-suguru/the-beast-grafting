import { error as logError } from "../shared/logger";

export function internalError(
  c: { json: (d: unknown, s: number) => Response },
  label: string,
  cause: unknown,
) {
  logError(label, cause);
  return c.json({ error: { type: "INTERNAL_ERROR" } }, 500);
}
