import { getTestDb, type TestDb } from "./test-db";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import {
  createSession,
  validateSession,
  revokeSession,
  cleanExpiredSessions,
  MAX_SESSIONS_PER_PLAYER,
} from "./session";
import { sessions } from "../../db/schema";

let testEnv: TestDb;
let db: DrizzleD1Database;

beforeAll(async () => {
  testEnv = await getTestDb();
  db = testEnv.db;
});

beforeEach(async () => {
  await testEnv.clean();
});

async function insertPlayer(testDb: DrizzleD1Database, id = "player-1") {
  const { players } = await import("../../db/schema");
  const now = new Date();
  await testDb.insert(players).values({ id, displayName: "Test", createdAt: now, updatedAt: now });
  return id;
}

describe("createSession", () => {
  it("returns token and expiresAt", async () => {
    const playerId = await insertPlayer(db);
    const result = await createSession(db, playerId);
    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value.token).toMatch(/^[0-9a-f]{64}$/);
    expect(result.value.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("validateSession", () => {
  it("returns playerId for valid session", async () => {
    const playerId = await insertPlayer(db);
    const createResult = await createSession(db, playerId);
    expect(createResult.isOk()).toBe(true);
    if (!createResult.isOk()) return;

    const result = await validateSession(db, createResult.value.token);
    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value).toEqual({ playerId });
  });

  it("returns null for expired session", async () => {
    const playerId = await insertPlayer(db);
    const createResult = await createSession(db, playerId);
    expect(createResult.isOk()).toBe(true);
    if (!createResult.isOk()) return;

    await db.update(sessions).set({ expiresAt: new Date(0) });

    const result = await validateSession(db, createResult.value.token);
    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value).toBeNull();
  });

  it("returns null for non-existent token", async () => {
    const result = await validateSession(db, "nonexistent-token");
    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value).toBeNull();
  });
});

describe("revokeSession", () => {
  it("invalidates session so validate returns null", async () => {
    const playerId = await insertPlayer(db);
    const createResult = await createSession(db, playerId);
    expect(createResult.isOk()).toBe(true);
    if (!createResult.isOk()) return;

    const revokeResult = await revokeSession(db, createResult.value.token);
    expect(revokeResult.isOk()).toBe(true);

    const validateResult = await validateSession(db, createResult.value.token);
    expect(validateResult.isOk()).toBe(true);
    if (!validateResult.isOk()) return;
    expect(validateResult.value).toBeNull();
  });
});

describe("session cap per player", () => {
  it("does not evict when exactly at MAX_SESSIONS_PER_PLAYER", async () => {
    const playerId = await insertPlayer(db);
    const tokens: string[] = [];

    for (let i = 0; i < MAX_SESSIONS_PER_PLAYER; i++) {
      const result = await createSession(db, playerId);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) tokens.push(result.value.token);
    }

    const rows = await db.select().from(sessions);
    expect(rows.length).toBe(MAX_SESSIONS_PER_PLAYER);

    let validCount = 0;
    for (const t of tokens) {
      const r = await validateSession(db, t);
      if (r.isOk() && r.value) validCount++;
    }
    expect(validCount).toBe(MAX_SESSIONS_PER_PLAYER);
  });

  it("keeps at most MAX_SESSIONS_PER_PLAYER and always preserves the newest", async () => {
    const playerId = await insertPlayer(db);
    const tokens: string[] = [];

    for (let i = 0; i < MAX_SESSIONS_PER_PLAYER + 2; i++) {
      const result = await createSession(db, playerId);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) tokens.push(result.value.token);
    }

    const rows = await db.select().from(sessions);
    expect(rows.length).toBe(MAX_SESSIONS_PER_PLAYER);

    const newest = await validateSession(db, tokens.at(-1)!);
    expect(newest.isOk()).toBe(true);
    if (newest.isOk()) expect(newest.value).toEqual({ playerId });

    let validCount = 0;
    for (const t of tokens) {
      const r = await validateSession(db, t);
      if (r.isOk() && r.value) validCount++;
    }
    expect(validCount).toBe(MAX_SESSIONS_PER_PLAYER);
  });
});

describe("cleanExpiredSessions", () => {
  it("removes only expired sessions", async () => {
    const playerId = await insertPlayer(db);
    const r1 = await createSession(db, playerId);
    const r2 = await createSession(db, playerId);
    expect(r1.isOk() && r2.isOk()).toBe(true);
    if (!r1.isOk() || !r2.isOk()) return;

    await db.update(sessions).set({ expiresAt: new Date(0) });

    const r3 = await createSession(db, playerId);
    expect(r3.isOk()).toBe(true);
    if (!r3.isOk()) return;

    const cleanResult = await cleanExpiredSessions(db);
    expect(cleanResult.isOk()).toBe(true);

    const expired1 = await validateSession(db, r1.value.token);
    const expired2 = await validateSession(db, r2.value.token);
    const valid = await validateSession(db, r3.value.token);

    expect(expired1.isOk() && expired1.value).toBeNull();
    expect(expired2.isOk() && expired2.value).toBeNull();
    expect(valid.isOk()).toBe(true);
    if (!valid.isOk()) return;
    expect(valid.value).toEqual({ playerId });
  });
});
