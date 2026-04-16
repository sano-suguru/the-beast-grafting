import { Hono } from "hono";
import { getTestDb, type TestDb } from "../test-db";
import { rateLimit, cleanExpiredRateLimits } from "./rate-limit";
import { rateLimits } from "../../db/schema";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { AppEnv } from "./types";
import { TEST_ENV } from "./test-helpers";

let testEnv: TestDb;
let testDb: DrizzleD1Database;

function createApp(opts: { max: number; windowSec: number }) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", testDb);
    await next();
  });
  app.get("/test", rateLimit({ prefix: "test", ...opts }), (c) => c.json({ ok: true }));
  return app;
}

function makeRequest(app: Hono<AppEnv>, ip = "1.2.3.4") {
  return app.request("/test", { headers: { "cf-connecting-ip": ip } }, TEST_ENV);
}

beforeAll(async () => {
  testEnv = await getTestDb();
  testDb = testEnv.db;
});

beforeEach(async () => {
  await testEnv.clean();
});

describe("rateLimit", () => {
  it("allows requests within limit", async () => {
    const app = createApp({ max: 3, windowSec: 60 });
    const res1 = await makeRequest(app);
    const res2 = await makeRequest(app);
    const res3 = await makeRequest(app);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);
  });

  it("returns 429 when limit exceeded", async () => {
    const app = createApp({ max: 2, windowSec: 60 });
    await makeRequest(app);
    await makeRequest(app);
    const res = await makeRequest(app);
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { type: string } };
    expect(body.error.type).toBe("RATE_LIMITED");
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("resets counter after window expires", async () => {
    const app = createApp({ max: 1, windowSec: 10 });
    await makeRequest(app);
    const blocked = await makeRequest(app);
    expect(blocked.status).toBe(429);

    // Advance time past the window
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 11_000);
    const res = await makeRequest(app);
    expect(res.status).toBe(200);
    vi.restoreAllMocks();
  });

  it("tracks different IPs independently", async () => {
    const app = createApp({ max: 1, windowSec: 60 });
    const res1 = await makeRequest(app, "10.0.0.1");
    const res2 = await makeRequest(app, "10.0.0.2");
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  it("fails open on DB error", async () => {
    const app = new Hono<AppEnv>();
    const badDb = {
      run: () => Promise.reject(new Error("db down")),
    } as unknown as DrizzleD1Database;
    app.use("*", async (c, next) => {
      c.set("db", badDb);
      await next();
    });
    app.get("/test", rateLimit({ prefix: "test", max: 1, windowSec: 60 }), (c) =>
      c.json({ ok: true }),
    );
    const res = await app.request(
      "/test",
      { headers: { "cf-connecting-ip": "1.2.3.4" } },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
  });
});

describe("cleanExpiredRateLimits", () => {
  it("deletes expired entries", async () => {
    const oldEpoch = Math.floor(Date.now() / 1000) - 7200;
    const nowEpoch = Math.floor(Date.now() / 1000);
    await testDb.insert(rateLimits).values({ key: "old:1.2.3.4", count: 5, windowStart: oldEpoch });
    await testDb.insert(rateLimits).values({ key: "new:1.2.3.4", count: 1, windowStart: nowEpoch });

    const result = await cleanExpiredRateLimits(testDb);
    expect(result.isOk()).toBe(true);

    const remaining = await testDb.select().from(rateLimits);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.key).toBe("new:1.2.3.4");
  });
});
