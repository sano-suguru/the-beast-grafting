import { eq, lt, desc, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { safeAsync, dbErr } from "../../shared/errors";
import type { Result, InfraError } from "../../shared/errors";
import { sessions } from "../../db/schema";
import { generateToken, hashToken } from "./crypto";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_SESSIONS_PER_PLAYER = 5;

export function createSession(
  db: DrizzleD1Database,
  playerId: string,
): Promise<Result<{ token: string; expiresAt: Date }, InfraError>> {
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  return safeAsync(async () => {
    const tokenHash = await hashToken(token);
    await db.insert(sessions).values({ tokenHash, playerId, expiresAt, createdAt: now });

    // D1 (SQLite) は書き込みをシリアライズするため SELECT→DELETE の非アトミック性は問題にならない
    const all = await db
      .select({ tokenHash: sessions.tokenHash })
      .from(sessions)
      .where(eq(sessions.playerId, playerId))
      .orderBy(desc(sessions.createdAt));

    // 新規セッションは必ず保持し、残りを古い順に削除
    const kept = new Set<string>([tokenHash]);
    for (const s of all) {
      if (kept.size >= MAX_SESSIONS_PER_PLAYER) break;
      kept.add(s.tokenHash);
    }
    const toDelete = all.filter((s) => !kept.has(s.tokenHash)).map((s) => s.tokenHash);
    if (toDelete.length > 0) {
      await db.delete(sessions).where(inArray(sessions.tokenHash, toDelete));
    }

    return { token, expiresAt };
  }, dbErr);
}

export function validateSession(
  db: DrizzleD1Database,
  token: string,
): Promise<Result<{ playerId: string } | null, InfraError>> {
  return safeAsync(async () => {
    const tokenHash = await hashToken(token);
    const rows = await db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)).limit(1);
    const session = rows[0];
    if (!session || session.expiresAt < new Date()) return null;
    return { playerId: session.playerId };
  }, dbErr);
}

export function revokeSession(
  db: DrizzleD1Database,
  token: string,
): Promise<Result<void, InfraError>> {
  return safeAsync(async () => {
    const tokenHash = await hashToken(token);
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }, dbErr);
}

export function cleanExpiredSessions(db: DrizzleD1Database): Promise<Result<void, InfraError>> {
  return safeAsync(async () => {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  }, dbErr);
}
