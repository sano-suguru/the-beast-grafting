import { Hono } from "hono";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { createTestDb } from "../auth/test-db";
import { battles } from "../../db/schema";
import pvp from "./routes";
import { TEST_ENV } from "../auth/test-helpers";
import { createTestPlayer, createTestRun, makeValidUnit } from "../test-helpers";
import type { AuthEnv } from "../auth/types";

let testDb: DrizzleD1Database;

function createBattleTestApp(getDb: () => DrizzleD1Database): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();
  app.use("*", async (c, next) => {
    c.set("db", getDb());
    await next();
  });
  app.route("/pvp", pvp);
  return app;
}

function postSnapshot(app: Hono<AuthEnv>, token: string, body: unknown) {
  return app.request(
    "/pvp/snapshot",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `session=${token}` },
      body: JSON.stringify(body),
    },
    TEST_ENV,
  );
}

function postBattle(app: Hono<AuthEnv>, token: string, body: unknown) {
  return app.request(
    "/pvp/battle",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `session=${token}` },
      body: JSON.stringify(body),
    },
    TEST_ENV,
  );
}

let app: Hono<AuthEnv>;

beforeEach(() => {
  testDb = createTestDb();
  app = createBattleTestApp(() => testDb);
});

describe("POST /pvp/battle", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await app.request(
      "/pvp/battle",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      TEST_ENV,
    );
    expect(res.status).toBe(401);
  });

  it("rejects invalid JSON body", async () => {
    const { token } = await createTestPlayer(testDb);
    const res = await app.request(
      "/pvp/battle",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `session=${token}` },
        body: "not-json",
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid round", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const res = await postBattle(app, token, { runId, round: 0 });
    expect(res.status).toBe(400);
  });

  it("rejects when no snapshot exists", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    const res = await postBattle(app, token, { runId, round: 3 });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { reason: string } };
    expect(body.error.reason).toBe("no_snapshot");
  });

  it("executes battle and returns frames", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    await postSnapshot(app, token, { runId, round: 3, board: [makeValidUnit()] });

    const res = await postBattle(app, token, { runId, round: 3 });
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      battleId: string;
      frames: unknown[];
      result: string;
      opponent: { teamName: string };
      seed: number;
    };
    expect(body.battleId).toBeTruthy();
    expect(body.frames.length).toBeGreaterThan(0);
    expect(["WIN", "LOSE", "DRAW"]).toContain(body.result);
    expect(body.opponent.teamName).toBeTruthy();
    expect(typeof body.seed).toBe("number");
  });

  it("stores battle record in database", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    await postSnapshot(app, token, { runId, round: 3, board: [makeValidUnit()] });

    await postBattle(app, token, { runId, round: 3 });

    const rows = await testDb.select().from(battles).where(eq(battles.playerId, playerId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.round).toBe(3);
    expect(["WIN", "LOSE", "DRAW"]).toContain(rows[0]!.result);
  });

  it("uses bot when no PvP opponent available", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    await postSnapshot(app, token, { runId, round: 3, board: [makeValidUnit()] });

    const res = await postBattle(app, token, { runId, round: 3 });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { opponent: { teamName: string } };
    expect(body.opponent.teamName).toBeTruthy();
  });

  it("produces deterministic results with same seed", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    await postSnapshot(app, token, {
      runId,
      round: 3,
      board: [makeValidUnit({ atk: 10, hp: 10 })],
    });
    await postSnapshot(app, token, {
      runId,
      round: 4,
      board: [makeValidUnit({ atk: 10, hp: 10 })],
    });

    const res1 = await postBattle(app, token, { runId, round: 3 });
    const res2 = await postBattle(app, token, { runId, round: 4 });
    const body1 = (await res1.json()) as { seed: number; result: string };
    const body2 = (await res2.json()) as { seed: number; result: string };
    expect(typeof body1.seed).toBe("number");
    expect(typeof body2.seed).toBe("number");
  });

  it("uses PvP opponent when available", async () => {
    const { token: tokenA, playerId: playerIdA } = await createTestPlayer(testDb, "playerA");
    const { token: tokenB, playerId: playerIdB } = await createTestPlayer(testDb, "playerB");
    const runIdA = await createTestRun(testDb, playerIdA);
    const runIdB = await createTestRun(testDb, playerIdB);

    await postSnapshot(app, tokenA, { runId: runIdA, round: 3, board: [makeValidUnit()] });
    await postSnapshot(app, tokenB, {
      runId: runIdB,
      round: 3,
      board: [makeValidUnit({ atk: 5, hp: 5 })],
    });

    const res = await postBattle(app, tokenA, { runId: runIdA, round: 3 });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { opponent: { teamName: string } };
    expect(body.opponent.teamName).toContain("playerB");
  });

  it("does not leak secretLore in response", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    await postSnapshot(app, token, { runId, round: 3, board: [makeValidUnit()] });

    const res = await postBattle(app, token, { runId, round: 3 });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { opponent: { units: Record<string, unknown>[] } };
    for (const unit of body.opponent.units) {
      expect(unit).not.toHaveProperty("secretLore");
    }
  });

  it("sets opponentPlayerId for PvP matches", async () => {
    const { token: tokenA, playerId: playerA } = await createTestPlayer(testDb, "playerA");
    const { token: tokenB, playerId: playerB } = await createTestPlayer(testDb, "playerB");
    const runIdA = await createTestRun(testDb, playerA);
    const runIdB = await createTestRun(testDb, playerB);

    await postSnapshot(app, tokenA, { runId: runIdA, round: 3, board: [makeValidUnit()] });
    await postSnapshot(app, tokenB, {
      runId: runIdB,
      round: 3,
      board: [makeValidUnit({ atk: 5, hp: 5 })],
    });

    await postBattle(app, tokenA, { runId: runIdA, round: 3 });

    const rows = await testDb.select().from(battles).where(eq(battles.playerId, playerA));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.opponentPlayerId).toBe(playerB);
  });

  it("rejects duplicate battle for same run+round", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    await postSnapshot(app, token, { runId, round: 3, board: [makeValidUnit()] });

    const res1 = await postBattle(app, token, { runId, round: 3 });
    expect(res1.status).toBe(200);

    const res2 = await postBattle(app, token, { runId, round: 3 });
    expect(res2.status).toBe(409);
    const body = (await res2.json()) as { error: { reason: string } };
    expect(body.error.reason).toBe("battle_already_exists");
  });

  it("sets opponentPlayerId to null for bot matches", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const runId = await createTestRun(testDb, playerId);
    await postSnapshot(app, token, { runId, round: 3, board: [makeValidUnit()] });

    await postBattle(app, token, { runId, round: 3 });

    const rows = await testDb.select().from(battles).where(eq(battles.playerId, playerId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.opponentPlayerId).toBeNull();
  });
});
