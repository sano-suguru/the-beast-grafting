import { Hono } from "hono";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { AppEnv } from "./types";

export const TEST_ENV = {
  DB: {},
  ALLOWED_ORIGIN: "http://localhost:5173",
  DISCORD_CLIENT_ID: "test-discord-client-id",
  DISCORD_CLIENT_SECRET: "test-discord-client-secret",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  OAUTH_STATE_SECRET: "test-secret",
} as Env;

export function createAuthTestApp(
  getDb: () => DrizzleD1Database,
  auth: Hono<AppEnv>,
): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", getDb());
    await next();
  });
  app.route("/", auth);
  return app;
}

function mutate(
  method: string,
  app: Hono<AppEnv>,
  path: string,
  body?: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  const init: RequestInit = {
    method,
    headers: { Origin: TEST_ENV.ALLOWED_ORIGIN as string, ...headers },
  };
  if (body) {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return app.request(path, init, TEST_ENV);
}

export const post = mutate.bind(null, "POST");
export const patch = mutate.bind(null, "PATCH");

export function get(app: Hono<AppEnv>, path: string, headers: Record<string, string> = {}) {
  return app.request(path, { method: "GET", headers }, TEST_ENV);
}

export function extractCookie(res: Response, name: string): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ?? "";
}

export function extractSessionCookie(res: Response): string {
  return extractCookie(res, "session");
}
