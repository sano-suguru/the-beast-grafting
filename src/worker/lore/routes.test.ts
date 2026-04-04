import { Hono } from "hono";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { createTestDb } from "../auth/test-db";
import { TEST_ENV } from "../auth/test-helpers";
import { createTestPlayer } from "../test-helpers";
import type { AuthEnv } from "../auth/types";
import type { LoreResponse } from "../../shared/api-types";
import { markSeen, markMastered } from "./lore-service";
import lore from "./routes";

let db: DrizzleD1Database;
let app: Hono<AuthEnv>;

function createLoreTestApp(getDb: () => DrizzleD1Database): Hono<AuthEnv> {
  const a = new Hono<AuthEnv>();
  a.use("*", async (c, next) => {
    c.set("db", getDb());
    await next();
  });
  a.route("/", lore);
  return a;
}

function getLoreRequest(token: string) {
  return app.request("/", { headers: { Cookie: `session=${token}` } }, TEST_ENV);
}

beforeEach(() => {
  db = createTestDb();
  app = createLoreTestApp(() => db);
});

describe("GET /lore", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await app.request("/", {}, TEST_ENV);
    expect(res.status).toBe(401);
  });

  it("returns empty lore for new player", async () => {
    const { token } = await createTestPlayer(db);
    const res = await getLoreRequest(token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { lore: LoreResponse };
    expect(body.lore).toEqual({});
  });

  it("returns seen and mastered entries", async () => {
    const { playerId, token } = await createTestPlayer(db);
    await markSeen(db, playerId, ["rat", "bat"]);
    await markMastered(db, playerId, ["rat"]);

    const res = await getLoreRequest(token);
    const body = (await res.json()) as { lore: LoreResponse };
    expect(body.lore["rat"]).toEqual({ mastered: true });
    expect(body.lore["bat"]).toEqual({ mastered: false });
  });

  it("does not leak lore from other players", async () => {
    const { playerId: other } = await createTestPlayer(db, "other");
    await markSeen(db, other, ["rat"]);

    const { token } = await createTestPlayer(db, "viewer");
    const res = await getLoreRequest(token);
    const body = (await res.json()) as { lore: LoreResponse };
    expect(body.lore).toEqual({});
  });
});
