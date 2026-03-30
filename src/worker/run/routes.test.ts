import { Hono } from "hono";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { createTestDb } from "../auth/test-db";
import { runs, battles, shopStates } from "../../db/schema";
import { generateId } from "../auth/crypto";
import runRoutes, { consumeAndAdvance } from "./routes";
import { TEST_ENV } from "../auth/test-helpers";
import { createTestPlayer } from "../test-helpers";
import type { AuthEnv } from "../auth/types";

interface RunResponse {
  run: {
    id: string;
    round: number;
    sanity: number;
    trophy: number;
    status: string;
    originId: string | null;
  };
}

let testDb: DrizzleD1Database;

function createRunTestApp(getDb: () => DrizzleD1Database): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();
  app.use("*", async (c, next) => {
    c.set("db", getDb());
    await next();
  });
  app.route("/", runRoutes);
  return app;
}

async function insertBattle(
  db: DrizzleD1Database,
  playerId: string,
  runId: string,
  round: number,
  result: "WIN" | "LOSE" | "DRAW",
) {
  const id = generateId();
  await db.insert(battles).values({
    id,
    playerId,
    runId,
    opponentPlayerId: null,
    round,
    seed: 12345,
    result,
    createdAt: new Date(),
  });
  return id;
}

function postStart(app: Hono<AuthEnv>, token: string, body: unknown = {}) {
  return app.request(
    "/start",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `session=${token}` },
      body: JSON.stringify(body),
    },
    TEST_ENV,
  );
}

function getCurrent(app: Hono<AuthEnv>, token: string) {
  return app.request(
    "/current",
    { method: "GET", headers: { Cookie: `session=${token}` } },
    TEST_ENV,
  );
}

function postAdvance(app: Hono<AuthEnv>, token: string, battleId: string) {
  return app.request(
    "/advance",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `session=${token}` },
      body: JSON.stringify({ battleId }),
    },
    TEST_ENV,
  );
}

let app: Hono<AuthEnv>;

beforeEach(() => {
  testDb = createTestDb();
  app = createRunTestApp(() => testDb);
});

describe("POST /start", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await app.request(
      "/start",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      TEST_ENV,
    );
    expect(res.status).toBe(401);
  });

  it("creates a new run", async () => {
    const { token } = await createTestPlayer(testDb);
    const res = await postStart(app, token, { originId: "thief" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { run: { round: number; sanity: number; trophy: number } };
    expect(body.run.round).toBe(1);
    expect(body.run.sanity).toBe(5);
    expect(body.run.trophy).toBe(0);
  });

  it("rejects duplicate active run", async () => {
    const { token } = await createTestPlayer(testDb);
    await postStart(app, token);
    const res = await postStart(app, token);
    expect(res.status).toBe(409);
  });

  it("accepts null originId", async () => {
    const { token } = await createTestPlayer(testDb);
    const res = await postStart(app, token, {});
    expect(res.status).toBe(200);
  });

  it("rejects invalid originId string", async () => {
    const { token } = await createTestPlayer(testDb);
    const res = await postStart(app, token, { originId: "invalid_origin" });
    expect(res.status).toBe(400);
  });
});

describe("GET /current", () => {
  it("returns null when no active run", async () => {
    const { token } = await createTestPlayer(testDb);
    const res = await getCurrent(app, token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { run: null };
    expect(body.run).toBeNull();
  });

  it("returns active run", async () => {
    const { token } = await createTestPlayer(testDb);
    await postStart(app, token, { originId: "surgeon" });

    const res = await getCurrent(app, token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { run: { originId: string; status: string } };
    expect(body.run.originId).toBe("surgeon");
    expect(body.run.status).toBe("active");
  });
});

describe("POST /advance", () => {
  it("rejects invalid battleId", async () => {
    const { token } = await createTestPlayer(testDb);
    const res = await postAdvance(app, token, "nonexistent");
    expect(res.status).toBe(404);
  });

  it("rejects other player's battle", async () => {
    const { token: tokenA } = await createTestPlayer(testDb, "A");
    const { token: tokenB, playerId: playerB } = await createTestPlayer(testDb, "B");

    await postStart(app, tokenA);
    const resB = await postStart(app, tokenB);
    const { run: runB } = (await resB.json()) as RunResponse;
    const battleId = await insertBattle(testDb, playerB, runB.id, 1, "WIN");

    const res = await postAdvance(app, tokenA, battleId);
    expect(res.status).toBe(403);
  });

  it("advances round on WIN", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const startRes = await postStart(app, token);
    const { run } = (await startRes.json()) as RunResponse;
    const battleId = await insertBattle(testDb, playerId, run.id, 1, "WIN");

    const res = await postAdvance(app, token, battleId);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      run: { round: number; trophy: number; sanity: number; status: string };
    };
    expect(body.run.round).toBe(2);
    expect(body.run.trophy).toBe(1);
    expect(body.run.sanity).toBe(5);
    expect(body.run.status).toBe("active");
  });

  it("decrements sanity on LOSE", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const startRes = await postStart(app, token);
    const { run } = (await startRes.json()) as RunResponse;
    const battleId = await insertBattle(testDb, playerId, run.id, 1, "LOSE");

    const res = await postAdvance(app, token, battleId);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { run: { sanity: number; status: string } };
    expect(body.run.sanity).toBe(4);
    expect(body.run.status).toBe("active");
  });

  it("keeps state on DRAW", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const startRes = await postStart(app, token);
    const { run } = (await startRes.json()) as RunResponse;
    const battleId = await insertBattle(testDb, playerId, run.id, 1, "DRAW");

    const res = await postAdvance(app, token, battleId);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { run: { sanity: number; trophy: number } };
    expect(body.run.sanity).toBe(5);
    expect(body.run.trophy).toBe(0);
  });

  it("sets status to 'won' at 10 trophies", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const startRes = await postStart(app, token);
    const { run } = (await startRes.json()) as RunResponse;

    await testDb.update(runs).set({ trophy: 9 }).where(eq(runs.id, run.id));

    const battleId = await insertBattle(testDb, playerId, run.id, 1, "WIN");
    const res = await postAdvance(app, token, battleId);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { run: { trophy: number; status: string } };
    expect(body.run.trophy).toBe(10);
    expect(body.run.status).toBe("won");
  });

  it("sets status to 'lost' when sanity reaches 0", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const startRes = await postStart(app, token);
    const { run } = (await startRes.json()) as RunResponse;

    await testDb.update(runs).set({ sanity: 1 }).where(eq(runs.id, run.id));

    const battleId = await insertBattle(testDb, playerId, run.id, 1, "LOSE");
    const res = await postAdvance(app, token, battleId);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { run: { sanity: number; status: string } };
    expect(body.run.sanity).toBe(0);
    expect(body.run.status).toBe("lost");
  });

  it("rejects consumed battle", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const startRes = await postStart(app, token);
    const { run } = (await startRes.json()) as RunResponse;
    const battleId = await insertBattle(testDb, playerId, run.id, 1, "WIN");

    await testDb.update(battles).set({ consumed: true }).where(eq(battles.id, battleId));

    const res = await postAdvance(app, token, battleId);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { reason: string } };
    expect(body.error.reason).toBe("battle_already_consumed");
  });

  it("consumeAndAdvance returns false when battle already consumed", async () => {
    const { playerId } = await createTestPlayer(testDb);
    const now = new Date();
    const runId = generateId();
    await testDb.insert(runs).values({
      id: runId,
      playerId,
      round: 1,
      sanity: 5,
      trophy: 0,
      board: [],
      originId: null,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const battleId = await insertBattle(testDb, playerId, runId, 1, "WIN");

    const first = await consumeAndAdvance(testDb, battleId, runId, {
      round: 2,
      sanity: 5,
      trophy: 1,
      board: [],
      status: "active",
    });
    expect(first.isOk()).toBe(true);
    expect(first._unsafeUnwrap()).toBe(true);

    const second = await consumeAndAdvance(testDb, battleId, runId, {
      round: 3,
      sanity: 5,
      trophy: 2,
      board: [],
      status: "active",
    });
    expect(second.isOk()).toBe(true);
    expect(second._unsafeUnwrap()).toBe(false);

    const runRow = await testDb.select().from(runs).where(eq(runs.id, runId)).limit(1);
    expect(runRow[0]!.trophy).toBe(1);
  });

  it("rejects battle with mismatched round", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const startRes = await postStart(app, token);
    const { run } = (await startRes.json()) as RunResponse;
    const battleId = await insertBattle(testDb, playerId, run.id, 5, "WIN");

    const res = await postAdvance(app, token, battleId);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { reason: string } };
    expect(body.error.reason).toBe("round_mismatch");
  });

  it("rejects battle from a different run", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const startRes = await postStart(app, token);
    const { run: activeRun } = (await startRes.json()) as RunResponse;

    const otherRunId = generateId();
    const now = new Date();
    await testDb.insert(runs).values({
      id: otherRunId,
      playerId,
      round: 1,
      sanity: 0,
      trophy: 3,
      board: [],
      originId: null,
      status: "lost",
      createdAt: now,
      updatedAt: now,
    });

    const battleId = await insertBattle(testDb, playerId, otherRunId, activeRun.round, "WIN");
    const res = await postAdvance(app, token, battleId);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { reason: string } };
    expect(body.error.reason).toBe("run_mismatch");
  });

  it("rejects advance on finished (won) run", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const startRes = await postStart(app, token);
    const { run } = (await startRes.json()) as RunResponse;

    await testDb.update(runs).set({ status: "won", trophy: 10 }).where(eq(runs.id, run.id));

    const battleId = await insertBattle(testDb, playerId, run.id, 1, "WIN");
    const res = await postAdvance(app, token, battleId);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { reason: string } };
    expect(body.error.reason).toBe("run_finished");
  });

  it("rejects advance on finished (lost) run", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const startRes = await postStart(app, token);
    const { run } = (await startRes.json()) as RunResponse;

    await testDb.update(runs).set({ status: "lost", sanity: 0 }).where(eq(runs.id, run.id));

    const battleId = await insertBattle(testDb, playerId, run.id, 1, "LOSE");
    const res = await postAdvance(app, token, battleId);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { reason: string } };
    expect(body.error.reason).toBe("run_finished");
  });

  it("updates board from latest shop state", async () => {
    const { token, playerId } = await createTestPlayer(testDb);
    const startRes = await postStart(app, token);
    const { run } = (await startRes.json()) as RunResponse;

    const ratUnit = {
      id: "rat" as const,
      name: "疫病ネズミ",
      baseAtk: 2,
      baseHp: 2,
      atk: 5,
      hp: 5,
      tier: 1,
      level: 2,
      exp: 2,
      equip: null,
      uid: "test-uid",
      isChurch: false,
      skillText: "",
      lore: "",
    };
    const now = new Date();

    await testDb.insert(shopStates).values({
      id: generateId(),
      runId: run.id,
      round: 1,
      blood: 10,
      freeRoll: false,
      cultistUsed: false,
      rotRingUses: 0,
      shopUnits: [],
      shopItems: [],
      board: [ratUnit, null, null, null, null],
      rngS0: 1,
      rngS1: 2,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    const battleId = await insertBattle(testDb, playerId, run.id, 1, "WIN");
    await postAdvance(app, token, battleId);

    const row = await testDb.select().from(runs).where(eq(runs.playerId, playerId)).limit(1);
    expect(row[0]!.board).toHaveLength(5);
    expect(row[0]!.board[0]!.atk).toBe(5);
    expect(row[0]!.board[1]).toBeNull();
  });
});
