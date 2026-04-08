import type { DrizzleD1Database } from "drizzle-orm/d1";
import { getTestDb, type TestDb } from "../auth/test-db";
import { boardSnapshots } from "../../db/schema";
import { cleanOldSnapshots } from "./cleanup";
import { createTestPlayer, createTestRun, makeValidUnit } from "../test-helpers";

let testEnv: TestDb;
let testDb: DrizzleD1Database;
let playerId: string;
let runId: string;

async function insertSnapshot(db: DrizzleD1Database, round: number, age: Date) {
  await db.insert(boardSnapshots).values({
    id: `snap-${round}-${Math.random().toString(36).slice(2, 8)}`,
    playerId,
    runId,
    round,
    board: [makeValidUnit()],
    life: 5,
    trophy: 0,
    createdAt: age,
  });
}

beforeAll(async () => {
  testEnv = await getTestDb();
  testDb = testEnv.db;
});

beforeEach(async () => {
  await testEnv.clean();
  const player = await createTestPlayer(testDb);
  playerId = player.playerId;
  runId = await createTestRun(testDb, playerId);
});

describe("cleanOldSnapshots", () => {
  it("deletes snapshots older than 7 days", async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await insertSnapshot(testDb, 1, eightDaysAgo);

    const result = await cleanOldSnapshots(testDb);
    expect(result.isOk()).toBe(true);

    const remaining = await testDb.select().from(boardSnapshots);
    expect(remaining).toHaveLength(0);
  });

  it("keeps snapshots newer than 7 days", async () => {
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    await insertSnapshot(testDb, 1, sixDaysAgo);

    const result = await cleanOldSnapshots(testDb);
    expect(result.isOk()).toBe(true);

    const remaining = await testDb.select().from(boardSnapshots);
    expect(remaining).toHaveLength(1);
  });

  it("deletes old while keeping new", async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const now = new Date();
    await insertSnapshot(testDb, 1, eightDaysAgo);
    await insertSnapshot(testDb, 2, now);

    await cleanOldSnapshots(testDb);

    const remaining = await testDb.select().from(boardSnapshots);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.round).toBe(2);
  });
});
