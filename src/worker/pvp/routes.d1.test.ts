import { Hono } from "hono";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { getTestDb, type TestDb } from "../auth/test-db";
import { boardSnapshots } from "../../db/schema";
import pvp from "./routes";
import { TEST_ENV } from "../auth/test-helpers";
import { createTestPlayer, createTestRun, makeValidUnit } from "../test-helpers";
import type { AuthEnv } from "../auth/types";

let testEnv: TestDb;
let testDb: DrizzleD1Database;

function createPvpTestApp(getDb: () => DrizzleD1Database): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();
  app.use("*", async (c, next) => {
    c.set("db", getDb());
    await next();
  });
  app.route("/", pvp);
  return app;
}

function postSnapshot(app: Hono<AuthEnv>, token: string, body: unknown) {
  return app.request(
    "/snapshot",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `session=${token}` },
      body: JSON.stringify(body),
    },
    TEST_ENV,
  );
}

let app: Hono<AuthEnv>;

beforeAll(async () => {
  testEnv = await getTestDb();
  testDb = testEnv.db;
});

beforeEach(async () => {
  await testEnv.clean();
  app = createPvpTestApp(() => testDb);
});

describe("POST /snapshot", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await app.request(
      "/snapshot",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      TEST_ENV,
    );
    expect(res.status).toBe(401);
  });

  it("rejects invalid JSON body", async () => {
    const { token } = await createTestPlayer(testDb);
    const res = await app.request(
      "/snapshot",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `session=${token}` },
        body: "not-json",
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing night", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const res = await postSnapshot(app, token, { runId, board: [makeValidUnit()] });
    expect(res.status).toBe(400);
  });

  it("rejects non-integer night", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const res = await postSnapshot(app, token, { runId, night: 1.5, board: [makeValidUnit()] });
    expect(res.status).toBe(400);
  });

  it("rejects night < 1", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const res = await postSnapshot(app, token, { runId, night: 0, board: [makeValidUnit()] });
    expect(res.status).toBe(400);
  });

  it("rejects empty board", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const res = await postSnapshot(app, token, { runId, night: 1, board: [] });
    expect(res.status).toBe(400);
  });

  it("rejects board exceeding max size", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const board = Array.from({ length: 6 }, () => makeValidUnit());
    const res = await postSnapshot(app, token, { runId, night: 1, board });
    expect(res.status).toBe(400);
  });

  it("rejects board with invalid unit structure", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const res = await postSnapshot(app, token, { runId, night: 1, board: [{ garbage: true }] });
    expect(res.status).toBe(400);
  });

  it("rejects unit missing required field", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const { isChurch: _, ...incomplete } = makeValidUnit();
    const res = await postSnapshot(app, token, { runId, night: 1, board: [incomplete] });
    expect(res.status).toBe(400);
  });

  it("rejects missing runId", async () => {
    const { token } = await createTestPlayer(testDb);
    const res = await postSnapshot(app, token, { night: 3, board: [makeValidUnit()] });
    expect(res.status).toBe(400);
  });

  it("rejects invalid runId", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    await createTestRun(testDb, playerId);
    const res = await postSnapshot(app, token, {
      runId: "nonexistent",
      night: 3,
      board: [makeValidUnit()],
    });
    expect(res.status).toBe(400);
  });

  it("accepts valid snapshot", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const res = await postSnapshot(app, token, { runId, night: 3, board: [makeValidUnit()] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("accepts unit with valid equip value", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const unit = makeValidUnit({ equip: "iron" });
    const res = await postSnapshot(app, token, { runId, night: 2, board: [unit] });
    expect(res.status).toBe(200);
  });

  it("rejects unit with invalid equip value", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const unit = makeValidUnit({ equip: "hax" });
    const res = await postSnapshot(app, token, { runId, night: 2, board: [unit] });
    expect(res.status).toBe(400);
  });

  it("accepts max board size (5 units)", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const board = Array.from({ length: 5 }, () => makeValidUnit());
    const res = await postSnapshot(app, token, { runId, night: 1, board });
    expect(res.status).toBe(200);
  });

  it("accepts night at MAX_NIGHT boundary", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const res = await postSnapshot(app, token, { runId, night: 20, board: [makeValidUnit()] });
    expect(res.status).toBe(200);
  });

  it("upserts on same run+night", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const unit1 = makeValidUnit({ buffAtk: 3 });
    const unit2 = makeValidUnit({ buffAtk: 97 });

    await postSnapshot(app, token, { runId, night: 3, board: [unit1] });
    await postSnapshot(app, token, { runId, night: 3, board: [unit2] });

    const rows = await testDb
      .select()
      .from(boardSnapshots)
      .where(and(eq(boardSnapshots.runId, runId), eq(boardSnapshots.night, 3)));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.board[0]).toMatchObject({ buffAtk: 97 });
  });

  it("rejects oversized payload", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const hugeUnit = makeValidUnit({ lore: "x".repeat(10_000) });
    const res = await postSnapshot(app, token, { runId, night: 1, board: [hugeUnit] });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { reason: string } };
    expect(body.error.reason).toBe("payload_too_large");
  });
});

describe("POST /snapshot – stat validation", () => {
  it("rejects unknown unit ID", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const unit = makeValidUnit({ id: "nonexistent_unit" });
    const res = await postSnapshot(app, token, { runId, night: 1, board: [unit] });
    expect(res.status).toBe(400);
  });

  it("rejects mismatched tier", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const unit = makeValidUnit({ tier: 6 });
    const res = await postSnapshot(app, token, { runId, night: 1, board: [unit] });
    expect(res.status).toBe(400);
  });

  it("rejects mismatched baseAtk", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const unit = makeValidUnit({ baseAtk: 99 });
    const res = await postSnapshot(app, token, { runId, night: 1, board: [unit] });
    expect(res.status).toBe(400);
  });

  it("rejects mismatched baseHp", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const unit = makeValidUnit({ baseHp: 99 });
    const res = await postSnapshot(app, token, { runId, night: 1, board: [unit] });
    expect(res.status).toBe(400);
  });

  it("rejects level out of range", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const unit = makeValidUnit({ level: 4 });
    const res = await postSnapshot(app, token, { runId, night: 1, board: [unit] });
    expect(res.status).toBe(400);
  });

  it("rejects level 0", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const unit = makeValidUnit({ level: 0 });
    const res = await postSnapshot(app, token, { runId, night: 1, board: [unit] });
    expect(res.status).toBe(400);
  });

  it("rejects negative buffAtk", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const unit = makeValidUnit({ buffAtk: -1 });
    const res = await postSnapshot(app, token, { runId, night: 1, board: [unit] });
    expect(res.status).toBe(400);
  });

  it("rejects effective atk exceeding ceiling", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const unit = makeValidUnit({ buffAtk: 9999 });
    const res = await postSnapshot(app, token, { runId, night: 1, board: [unit] });
    expect(res.status).toBe(400);
  });

  it("rejects night > MAX_NIGHT", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const res = await postSnapshot(app, token, { runId, night: 21, board: [makeValidUnit()] });
    expect(res.status).toBe(400);
  });

  it("accepts church unit with correct stats", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const unit = makeValidUnit({
      id: "squire",
      name: "見習い従騎士",
      baseAtk: 1,
      baseHp: 2,
      buffAtk: 0,
      buffHp: 0,
      tier: 1,
      isChurch: true,
    });
    const res = await postSnapshot(app, token, { runId, night: 1, board: [unit] });
    expect(res.status).toBe(200);
  });
});
