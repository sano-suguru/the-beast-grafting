import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { Context } from "hono";
import { validateSession } from "./session";

import { warn } from "../../shared/logger";
import type { AuthEnv, OptionalAuthEnv } from "./types";

function extractToken(c: Context): string | null {
  const cookie = getCookie(c, "session");
  if (cookie) return cookie;
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return null;
}

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const token = extractToken(c);
  if (!token) return c.json({ error: { type: "UNAUTHORIZED" } }, 401) as never;

  const db = c.get("db");
  const result = await validateSession(db, token);
  if (result.isErr()) return c.json({ error: { type: "INTERNAL_ERROR" } }, 500) as never;

  const session = result.value;
  if (!session) return c.json({ error: { type: "UNAUTHORIZED" } }, 401) as never;

  c.set("playerId", session.playerId);
  c.set("sessionToken", token);
  await next();
});

export const optionalAuth = createMiddleware<OptionalAuthEnv>(async (c, next) => {
  const token = extractToken(c);
  if (token) {
    const db = c.get("db");
    const result = await validateSession(db, token);
    if (result.isOk() && result.value) {
      c.set("playerId", result.value.playerId);
      c.set("sessionToken", token);
    } else if (result.isErr()) {
      warn("[optionalAuth] session validation failed", result.error);
    }
  }
  await next();
});
