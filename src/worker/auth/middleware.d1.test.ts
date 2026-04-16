import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { getTestDb, type TestDb } from "../test-db";
import { createSession } from "./session";
import { requireAuth, optionalAuth, csrfGuard } from "./middleware";
import { sessions } from "../../db/schema";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { AppEnv, AuthEnv, OptionalAuthEnv } from "./types";
import { TEST_ENV } from "./test-helpers";
import { invariant } from "../../shared/invariant";

let testEnv: TestDb;
let testDb: DrizzleD1Database;

function createMiddlewareTestApp(
  getDb: () => DrizzleD1Database,
  middleware: MiddlewareHandler<AuthEnv> | MiddlewareHandler<OptionalAuthEnv>,
  handler: (c: { json: (data: unknown) => Response; get: (key: string) => unknown }) => Response,
) {
  const app = new Hono<AuthEnv>();
  app.use("*", async (c, next) => {
    c.set("db", getDb());
    await next();
  });
  app.use("*", middleware as MiddlewareHandler<AuthEnv>);
  app.get("/test", (c) => handler(c));
  return app;
}

async function insertPlayer(id = "player-1") {
  const { players } = await import("../../db/schema");
  const now = new Date();
  await testDb.insert(players).values({ id, displayName: "Test", createdAt: now, updatedAt: now });
  return id;
}

async function createValidSession(playerId: string) {
  const result = await createSession(testDb, playerId);
  invariant(result.isOk(), "session creation must succeed in test");
  return result.value.token;
}

beforeAll(async () => {
  testEnv = await getTestDb();
  testDb = testEnv.db;
});

beforeEach(async () => {
  await testEnv.clean();
});

describe("requireAuth", () => {
  let app: Hono<AuthEnv>;

  beforeEach(() => {
    app = createMiddlewareTestApp(
      () => testDb,
      requireAuth,
      (c) => c.json({ playerId: c.get("playerId"), sessionToken: c.get("sessionToken") }),
    );
  });

  it("returns 401 when no token present", async () => {
    const res = await app.request("/test", {}, TEST_ENV);
    expect(res.status).toBe(401);
  });

  it("returns 401 for invalid session token", async () => {
    const res = await app.request("/test", { headers: { Cookie: "session=bad-token" } }, TEST_ENV);
    expect(res.status).toBe(401);
  });

  it("sets playerId and sessionToken on valid session", async () => {
    const playerId = await insertPlayer();
    const token = await createValidSession(playerId);

    const res = await app.request("/test", { headers: { Cookie: `session=${token}` } }, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { playerId: string; sessionToken: string };
    expect(body.playerId).toBe(playerId);
    expect(body.sessionToken).toBe(token);
  });

  it("extracts token from Bearer header", async () => {
    const playerId = await insertPlayer();
    const token = await createValidSession(playerId);

    const res = await app.request(
      "/test",
      { headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { playerId: string };
    expect(body.playerId).toBe(playerId);
  });

  it("prefers cookie over Bearer header", async () => {
    const playerId = await insertPlayer();
    const token = await createValidSession(playerId);

    const res = await app.request(
      "/test",
      { headers: { Cookie: `session=${token}`, Authorization: "Bearer invalid-token" } },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { playerId: string };
    expect(body.playerId).toBe(playerId);
  });

  it("returns 401 when Bearer header has no token after space", async () => {
    const res = await app.request("/test", { headers: { Authorization: "Bearer " } }, TEST_ENV);
    expect(res.status).toBe(401);
  });

  it("returns 401 when Authorization is 'Bearer' without space", async () => {
    const res = await app.request("/test", { headers: { Authorization: "Bearer" } }, TEST_ENV);
    expect(res.status).toBe(401);
  });

  it("returns 401 when session cookie is empty", async () => {
    const res = await app.request("/test", { headers: { Cookie: "session=" } }, TEST_ENV);
    expect(res.status).toBe(401);
  });

  it("returns 401 for expired session", async () => {
    const playerId = await insertPlayer();
    const token = await createValidSession(playerId);
    await testDb.update(sessions).set({ expiresAt: new Date(0) });

    const res = await app.request("/test", { headers: { Cookie: `session=${token}` } }, TEST_ENV);
    expect(res.status).toBe(401);
  });
});

describe("optionalAuth", () => {
  let app: Hono<AuthEnv>;

  beforeEach(() => {
    app = createMiddlewareTestApp(
      () => testDb,
      optionalAuth,
      (c) =>
        c.json({
          playerId: c.get("playerId") ?? null,
          sessionToken: c.get("sessionToken") ?? null,
        }),
    );
  });

  it("continues without playerId when no token", async () => {
    const res = await app.request("/test", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { playerId: string | null };
    expect(body.playerId).toBeNull();
  });

  it("sets playerId and sessionToken when valid session", async () => {
    const playerId = await insertPlayer();
    const token = await createValidSession(playerId);

    const res = await app.request("/test", { headers: { Cookie: `session=${token}` } }, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { playerId: string | null; sessionToken: string | null };
    expect(body.playerId).toBe(playerId);
    expect(body.sessionToken).toBe(token);
  });

  it("continues without playerId on invalid session", async () => {
    const res = await app.request("/test", { headers: { Cookie: "session=expired" } }, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { playerId: string | null };
    expect(body.playerId).toBeNull();
  });

  it("continues without playerId on expired session", async () => {
    const playerId = await insertPlayer();
    const token = await createValidSession(playerId);
    await testDb.update(sessions).set({ expiresAt: new Date(0) });

    const res = await app.request("/test", { headers: { Cookie: `session=${token}` } }, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { playerId: string | null };
    expect(body.playerId).toBeNull();
  });
});

describe("csrfGuard", () => {
  let app: Hono<AppEnv>;

  beforeEach(() => {
    app = new Hono<AppEnv>();
    app.use("*", csrfGuard);
    app.post("/action", (c) => c.json({ ok: true }));
    app.get("/read", (c) => c.json({ ok: true }));
    app.put("/action", (c) => c.json({ ok: true }));
    app.delete("/action", (c) => c.json({ ok: true }));
    app.on("PATCH", "/action", (c) => c.json({ ok: true }));
  });

  it("allows POST with matching Origin", async () => {
    const res = await app.request(
      "/action",
      { method: "POST", headers: { Origin: TEST_ENV.ALLOWED_ORIGIN as string } },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
  });

  it("rejects POST with wrong Origin", async () => {
    const res = await app.request(
      "/action",
      { method: "POST", headers: { Origin: "https://evil.example.com" } },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it("rejects POST with missing Origin", async () => {
    const res = await app.request("/action", { method: "POST" }, TEST_ENV);
    expect(res.status).toBe(403);
  });

  it("allows GET without Origin", async () => {
    const res = await app.request("/read", { method: "GET" }, TEST_ENV);
    expect(res.status).toBe(200);
  });

  it("rejects PUT with wrong Origin", async () => {
    const res = await app.request(
      "/action",
      { method: "PUT", headers: { Origin: "https://evil.example.com" } },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it("allows PUT with matching Origin", async () => {
    const res = await app.request(
      "/action",
      { method: "PUT", headers: { Origin: TEST_ENV.ALLOWED_ORIGIN as string } },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
  });

  it("rejects DELETE with missing Origin", async () => {
    const res = await app.request("/action", { method: "DELETE" }, TEST_ENV);
    expect(res.status).toBe(403);
  });

  it("rejects PATCH with wrong Origin", async () => {
    const res = await app.request(
      "/action",
      { method: "PATCH", headers: { Origin: "https://evil.example.com" } },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it("allows HEAD without Origin", async () => {
    const res = await app.request("/read", { method: "HEAD" }, TEST_ENV);
    expect(res.status).toBe(200);
  });

  it("allows OPTIONS without Origin", async () => {
    const res = await app.request("/read", { method: "OPTIONS" }, TEST_ENV);
    expect(res.status).not.toBe(403);
  });
});
