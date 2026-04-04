import type { DrizzleD1Database } from "drizzle-orm/d1";
import { createTestDb } from "../auth/test-db";
import { createTestPlayer } from "../test-helpers";
import { getLore, markSeen, markMastered } from "./lore-service";

let db: DrizzleD1Database;
let playerId: string;

beforeEach(async () => {
  db = createTestDb();
  ({ playerId } = await createTestPlayer(db));
});

describe("getLore", () => {
  it("returns empty object for new player", async () => {
    const result = await getLore(db, playerId);
    expect(result._unsafeUnwrap()).toEqual({});
  });

  it("returns seen entries after markSeen", async () => {
    await markSeen(db, playerId, ["rat", "bat"]);
    const lore = (await getLore(db, playerId))._unsafeUnwrap();
    expect(lore["rat"]).toEqual({ mastered: false });
    expect(lore["bat"]).toEqual({ mastered: false });
  });

  it("returns mastered entries after markMastered", async () => {
    await markMastered(db, playerId, ["rat"]);
    const lore = (await getLore(db, playerId))._unsafeUnwrap();
    expect(lore["rat"]).toEqual({ mastered: true });
  });
});

describe("markSeen", () => {
  it("is idempotent — repeated calls do not fail", async () => {
    await markSeen(db, playerId, ["rat"]);
    await markSeen(db, playerId, ["rat"]);
    const lore = (await getLore(db, playerId))._unsafeUnwrap();
    expect(Object.keys(lore)).toHaveLength(1);
  });

  it("does not overwrite mastered with seen-only", async () => {
    await markMastered(db, playerId, ["rat"]);
    await markSeen(db, playerId, ["rat"]);
    const lore = (await getLore(db, playerId))._unsafeUnwrap();
    expect(lore["rat"]!.mastered).toBe(true);
  });

  it("is no-op for empty array", async () => {
    const result = await markSeen(db, playerId, []);
    expect(result.isOk()).toBe(true);
    const lore = (await getLore(db, playerId))._unsafeUnwrap();
    expect(lore).toEqual({});
  });

  it("isolates lore between players", async () => {
    const { playerId: other } = await createTestPlayer(db, "other");
    await markSeen(db, playerId, ["rat"]);
    const otherLore = (await getLore(db, other))._unsafeUnwrap();
    expect(otherLore).toEqual({});
  });
});

describe("markMastered", () => {
  it("marks unseen unit as both seen and mastered", async () => {
    await markMastered(db, playerId, ["rat"]);
    const lore = (await getLore(db, playerId))._unsafeUnwrap();
    expect(lore["rat"]).toEqual({ mastered: true });
  });

  it("upgrades seen-only to mastered", async () => {
    await markSeen(db, playerId, ["rat"]);
    await markMastered(db, playerId, ["rat"]);
    const lore = (await getLore(db, playerId))._unsafeUnwrap();
    expect(lore["rat"]!.mastered).toBe(true);
  });

  it("is idempotent", async () => {
    await markMastered(db, playerId, ["rat"]);
    await markMastered(db, playerId, ["rat"]);
    const lore = (await getLore(db, playerId))._unsafeUnwrap();
    expect(lore["rat"]!.mastered).toBe(true);
  });

  it("handles multiple IDs in one call", async () => {
    await markMastered(db, playerId, ["rat", "bat"]);
    const lore = (await getLore(db, playerId))._unsafeUnwrap();
    expect(lore["rat"]!.mastered).toBe(true);
    expect(lore["bat"]!.mastered).toBe(true);
  });

  it("is no-op for empty array", async () => {
    const result = await markMastered(db, playerId, []);
    expect(result.isOk()).toBe(true);
  });
});
