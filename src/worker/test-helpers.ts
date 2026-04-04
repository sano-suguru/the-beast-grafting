import type { DrizzleD1Database } from "drizzle-orm/d1";
import { players, sessions, runs } from "../db/schema";
import { hashToken } from "./auth/crypto";
import type { BoardUnit } from "../shared/board-unit";

export async function createTestPlayer(
  db: DrizzleD1Database,
  name = "test-player",
): Promise<{ playerId: string; token: string }> {
  const playerId = `player-${Math.random().toString(36).slice(2, 8)}`;
  const token = `token-${Math.random().toString(36).slice(2, 8)}`;
  const tokenHash = await hashToken(token);
  const now = new Date();
  await db.insert(players).values({
    id: playerId,
    displayName: name,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(sessions).values({
    tokenHash,
    playerId,
    expiresAt: new Date(Date.now() + 86_400_000),
    createdAt: now,
  });
  return { playerId, token };
}

export async function createTestRun(db: DrizzleD1Database, playerId: string): Promise<string> {
  const runId = `run-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  await db.insert(runs).values({
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
  return runId;
}

export function makeValidUnit(overrides: Record<string, unknown> = {}): BoardUnit {
  return {
    id: "rat",
    name: "疫病ネズミ",
    baseAtk: 2,
    baseHp: 2,
    buffAtk: 0,
    buffHp: 0,
    tier: 1,
    level: 1,
    exp: 0,
    equip: null,
    uid: `u-${Math.random().toString(36).slice(2, 8)}`,
    isChurch: false,
    skillText: "",
    lore: "",
    ...overrides,
  } as BoardUnit;
}
