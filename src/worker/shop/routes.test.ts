import { Hono } from "hono";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { createTestDb } from "../auth/test-db";
import { boardSnapshots } from "../../db/schema";
import shopRoutes from "./routes";
import { TEST_ENV } from "../auth/test-helpers";
import { createTestPlayer, createTestRun } from "../test-helpers";
import type { AuthEnv } from "../auth/types";
import type { ShopStateResponse } from "../../shared/api-types";

let testDb: DrizzleD1Database;

function createShopTestApp(getDb: () => DrizzleD1Database): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();
  app.use("*", async (c, next) => {
    c.set("db", getDb());
    await next();
  });
  app.route("/", shopRoutes);
  return app;
}

function shopPost(
  app: Hono<AuthEnv>,
  path: string,
  token: string,
  body: Record<string, unknown> = {},
) {
  return app.request(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `session=${token}` },
      body: JSON.stringify(body),
    },
    TEST_ENV,
  );
}

async function setupShopState(
  app: Hono<AuthEnv>,
  token: string,
  runId: string,
): Promise<ShopStateResponse> {
  const res = await shopPost(app, "/setup", token, { runId });
  const body = (await res.json()) as { shop: ShopStateResponse };
  return body.shop;
}

let app: Hono<AuthEnv>;

beforeEach(() => {
  testDb = createTestDb();
  app = createShopTestApp(() => testDb);
});

describe("POST /setup", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await app.request(
      "/setup",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      TEST_ENV,
    );
    expect(res.status).toBe(401);
  });

  it("creates initial shop state for active run", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const res = await shopPost(app, "/setup", token, { runId });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { shop: ShopStateResponse };
    expect(body.shop.round).toBe(1);
    expect(body.shop.blood).toBe(10);
    expect(body.shop.board).toHaveLength(5);
  });

  it("returns 404 for non-existent run", async () => {
    const { token } = await createTestPlayer(testDb);
    const res = await shopPost(app, "/setup", token, { runId: "nonexistent" });
    expect(res.status).toBe(404);
  });

  it("returns 400 for missing runId", async () => {
    const { token } = await createTestPlayer(testDb);
    const res = await shopPost(app, "/setup", token, {});
    expect(res.status).toBe(400);
  });

  it("is idempotent for same round", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const res1 = await shopPost(app, "/setup", token, { runId });
    const res2 = await shopPost(app, "/setup", token, { runId });
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});

describe("POST /roll", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await app.request(
      "/roll",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      TEST_ENV,
    );
    expect(res.status).toBe(401);
  });

  it("returns new shop units after roll", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const initial = await setupShopState(app, token, runId);
    const res = await shopPost(app, "/roll", token, { runId });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { shop: ShopStateResponse };
    expect(body.shop.blood).toBeLessThanOrEqual(initial.blood);
  });

  it("returns 404 when no shop state exists", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const res = await shopPost(app, "/roll", token, { runId });
    expect(res.status).toBe(404);
  });
});

describe("POST /buy", () => {
  it("buys unit from shop to board", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const shop = await setupShopState(app, token, runId);
    const shopIdx = shop.shopUnits.findIndex((s) => s !== null);
    expect(shopIdx).toBeGreaterThanOrEqual(0);
    const res = await shopPost(app, "/buy", token, {
      runId,
      shopIndex: shopIdx,
      boardIndex: 0,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { shop: ShopStateResponse };
    expect(body.shop.board[0]).not.toBeNull();
  });

  it("returns 400 for invalid shopIndex", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    await setupShopState(app, token, runId);
    const res = await shopPost(app, "/buy", token, { runId, shopIndex: -1, boardIndex: 0 });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid boardIndex", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    await setupShopState(app, token, runId);
    const res = await shopPost(app, "/buy", token, { runId, shopIndex: 0, boardIndex: 5 });
    expect(res.status).toBe(400);
  });
});

describe("POST /sell", () => {
  it("sells unit from board and gains blood", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const shop = await setupShopState(app, token, runId);

    const shopIdx = shop.shopUnits.findIndex((s) => s !== null);
    expect(shopIdx).toBeGreaterThanOrEqual(0);
    await shopPost(app, "/buy", token, { runId, shopIndex: shopIdx, boardIndex: 0 });

    const res = await shopPost(app, "/sell", token, { runId, boardIndex: 0 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { shop: ShopStateResponse };
    expect(body.shop.board[0]).toBeNull();
  });

  it("returns 400 for empty board slot", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    await setupShopState(app, token, runId);
    const res = await shopPost(app, "/sell", token, { runId, boardIndex: 0 });
    expect(res.status).toBe(400);
  });
});

describe("POST /freeze", () => {
  it("freezes a shop slot", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const shop = await setupShopState(app, token, runId);
    const idx = shop.shopUnits.findIndex((s) => s !== null);
    expect(idx).toBeGreaterThanOrEqual(0);
    const res = await shopPost(app, "/freeze", token, {
      runId,
      isUnit: true,
      index: idx,
      frozen: true,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { shop: ShopStateResponse };
    expect(body.shop.shopUnits[idx]!.frozen).toBe(true);
  });

  it("returns 400 for missing params", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    await setupShopState(app, token, runId);
    const res = await shopPost(app, "/freeze", token, { runId, isUnit: true });
    expect(res.status).toBe(400);
  });
});

describe("POST /swap", () => {
  it("swaps two board positions", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const shop = await setupShopState(app, token, runId);

    const shopIdx = shop.shopUnits.findIndex((s) => s !== null);
    expect(shopIdx).toBeGreaterThanOrEqual(0);
    const buyRes = await shopPost(app, "/buy", token, { runId, shopIndex: shopIdx, boardIndex: 0 });
    const bought = ((await buyRes.json()) as { shop: ShopStateResponse }).shop;
    const unitAtZero = bought.board[0];

    const res = await shopPost(app, "/swap", token, { runId, fromIndex: 0, toIndex: 2 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { shop: ShopStateResponse };
    expect(body.shop.board[0]).toBeNull();
    expect(body.shop.board[2]?.id).toBe(unitAtZero?.id);
  });

  it("returns 400 for invalid index", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    await setupShopState(app, token, runId);
    const res = await shopPost(app, "/swap", token, { runId, fromIndex: 0, toIndex: 5 });
    expect(res.status).toBe(400);
  });
});

describe("POST /ready", () => {
  it("finalizes shop state when board has units", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const shop = await setupShopState(app, token, runId);

    const shopIdx = shop.shopUnits.findIndex((s) => s !== null);
    expect(shopIdx).toBeGreaterThanOrEqual(0);
    await shopPost(app, "/buy", token, { runId, shopIndex: shopIdx, boardIndex: 0 });

    const res = await shopPost(app, "/ready", token, { runId });
    expect(res.status).toBe(200);
  });

  it("returns 400 when board is empty", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    await setupShopState(app, token, runId);
    const res = await shopPost(app, "/ready", token, { runId });
    expect(res.status).toBe(400);
  });

  it("creates board snapshot", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const shop = await setupShopState(app, token, runId);

    const shopIdx = shop.shopUnits.findIndex((s) => s !== null);
    expect(shopIdx).toBeGreaterThanOrEqual(0);
    await shopPost(app, "/buy", token, { runId, shopIndex: shopIdx, boardIndex: 0 });

    await shopPost(app, "/ready", token, { runId });

    const snaps = await testDb
      .select()
      .from(boardSnapshots)
      .where(and(eq(boardSnapshots.runId, runId), eq(boardSnapshots.round, 1)));
    expect(snaps).toHaveLength(1);
  });
});

describe("POST /undo", () => {
  it("reverts last action when undo available", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const shop = await setupShopState(app, token, runId);

    const shopIdx = shop.shopUnits.findIndex((s) => s !== null);
    expect(shopIdx).toBeGreaterThanOrEqual(0);
    const bloodBefore = shop.blood;
    await shopPost(app, "/buy", token, { runId, shopIndex: shopIdx, boardIndex: 0 });

    const res = await shopPost(app, "/undo", token, { runId });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { shop: ShopStateResponse };
    expect(body.shop.blood).toBe(bloodBefore);
  });

  it("returns 400 when no undo snapshot", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    await setupShopState(app, token, runId);
    const res = await shopPost(app, "/undo", token, { runId });
    expect(res.status).toBe(400);
  });
});
