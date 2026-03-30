import type { DrizzleD1Database } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { createTestDb } from "../auth/test-db";
import { createTestPlayer, createTestRun, makeValidUnit } from "../test-helpers";
import { boardSnapshots, runs } from "../../db/schema";
import { findOpponent } from "./matchmaking";

let db: DrizzleD1Database;
let playerId: string;

async function insertSnapshot(pid: string, runId: string, round: number) {
  await db.insert(boardSnapshots).values({
    id: `snap-${Math.random().toString(36).slice(2, 8)}`,
    playerId: pid,
    runId,
    round,
    board: [makeValidUnit()],
    createdAt: new Date(),
  });
}

beforeEach(async () => {
  db = createTestDb();
  ({ playerId } = await createTestPlayer(db));
});

describe("findOpponent", () => {
  it("returns null when no snapshots exist", async () => {
    const result = await findOpponent(db, playerId, 3);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBeNull();
  });

  it("excludes own snapshots", async () => {
    const runId = await createTestRun(db, playerId);
    await insertSnapshot(playerId, runId, 3);

    const result = await findOpponent(db, playerId, 3);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBeNull();
  });

  it("matches opponent within ROUND_RANGE (±1)", async () => {
    const { playerId: opponentId } = await createTestPlayer(db, "opponent");
    const opponentRun = await createTestRun(db, opponentId);
    await insertSnapshot(opponentId, opponentRun, 4);

    const result = await findOpponent(db, playerId, 3);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).not.toBeNull();
    expect(result._unsafeUnwrap()!.playerId).toBe(opponentId);
  });

  it("does not match opponent outside ROUND_RANGE", async () => {
    const { playerId: opponentId } = await createTestPlayer(db, "opponent");
    const opponentRun = await createTestRun(db, opponentId);
    await insertSnapshot(opponentId, opponentRun, 6);

    const result = await findOpponent(db, playerId, 3);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBeNull();
  });

  it("only matches active runs", async () => {
    const { playerId: opponentId } = await createTestPlayer(db, "opponent");
    const opponentRun = await createTestRun(db, opponentId);
    await insertSnapshot(opponentId, opponentRun, 3);
    await db.update(runs).set({ status: "lost" }).where(eq(runs.id, opponentRun));

    const result = await findOpponent(db, playerId, 3);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBeNull();
  });

  it("returns correct PvpOpponent shape", async () => {
    const { playerId: opponentId } = await createTestPlayer(db, "rival");
    const opponentRun = await createTestRun(db, opponentId);
    await insertSnapshot(opponentId, opponentRun, 3);

    const result = await findOpponent(db, playerId, 3);
    expect(result.isOk()).toBe(true);
    const opponent = result._unsafeUnwrap()!;
    expect(opponent.playerId).toBe(opponentId);
    expect(opponent.teamName).toBe("[同業者] rival");
    expect(opponent.teamType).toBe("同業者");
    expect(opponent.units).toHaveLength(1);
  });
});
