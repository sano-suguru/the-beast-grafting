import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { sql, lt } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { safeAsync, dbErr } from "../../shared/errors";
import type { Result, InfraError } from "../../shared/errors";
import { rateLimits } from "../../db/schema";
import { warn } from "../../shared/logger";
import type { AppEnv } from "./types";

type RateLimitOpts = { prefix: string; max: number; windowSec: number };

function getClientIp(c: Context): string {
  return c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
}

function incrementCounter(db: DrizzleD1Database, key: string, windowSec: number) {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - windowSec;
  return safeAsync(
    async () =>
      db.all<{ count: number }>(sql`INSERT INTO rate_limits (key, count, window_start)
        VALUES (${key}, 1, ${now})
        ON CONFLICT(key) DO UPDATE SET
          count = CASE WHEN window_start > ${cutoff} THEN count + 1 ELSE 1 END,
          window_start = CASE WHEN window_start > ${cutoff} THEN window_start ELSE ${now} END
        RETURNING count`),
    dbErr,
  );
}

function extractCount(result: Result<{ count: number }[], InfraError>): number {
  return result.match(
    (rows) => rows[0]?.count ?? 0,
    (e) => {
      warn("[rateLimit] DB error, failing open", e);
      return 0;
    },
  );
}

export const rateLimit = (opts: RateLimitOpts) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const key = `${opts.prefix}:${getClientIp(c)}`;
    const count = extractCount(await incrementCounter(c.get("db"), key, opts.windowSec));

    if (count > opts.max) {
      c.header("Retry-After", String(opts.windowSec));
      return c.json({ error: { type: "RATE_LIMITED" } }, 429) as never;
    }

    await next();
  });

export function cleanExpiredRateLimits(db: DrizzleD1Database): Promise<Result<void, InfraError>> {
  const cutoff = Math.floor(Date.now() / 1000) - 3600;
  return safeAsync(async () => {
    await db.delete(rateLimits).where(lt(rateLimits.windowStart, cutoff));
  }, dbErr);
}
