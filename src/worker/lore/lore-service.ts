import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { ok, safeAsync, dbErr } from "../../shared/errors";
import type { Result, InfraError } from "../../shared/errors";
import type { LoreResponse } from "../../shared/api-types";
import { error as logError } from "../../shared/logger";
import { loreEntries } from "../../db/schema";

export function getLore(
  db: DrizzleD1Database,
  playerId: string,
): Promise<Result<LoreResponse, InfraError>> {
  return safeAsync(async () => {
    const rows = await db
      .select({ unitId: loreEntries.unitId, masteredAt: loreEntries.masteredAt })
      .from(loreEntries)
      .where(eq(loreEntries.playerId, playerId));

    const result: LoreResponse = {};
    for (const row of rows) {
      result[row.unitId] = { mastered: row.masteredAt !== null };
    }
    return result;
  }, dbErr);
}

function upsertLore(
  db: DrizzleD1Database,
  playerId: string,
  unitIds: string[],
  withMastered: boolean,
): Promise<Result<void, InfraError>> {
  if (unitIds.length === 0) return Promise.resolve(ok<void, InfraError>(undefined));
  const now = new Date();
  const values = unitIds.map((unitId) => ({
    playerId,
    unitId,
    seenAt: now,
    ...(withMastered ? { masteredAt: now } : {}),
  }));
  return safeAsync(async () => {
    const query = db.insert(loreEntries).values(values);
    if (withMastered) {
      await query.onConflictDoUpdate({
        target: [loreEntries.playerId, loreEntries.unitId],
        set: { masteredAt: now },
      });
    } else {
      await query.onConflictDoNothing();
    }
  }, dbErr);
}

export function markSeen(
  db: DrizzleD1Database,
  playerId: string,
  unitIds: string[],
): Promise<Result<void, InfraError>> {
  return upsertLore(db, playerId, unitIds, false);
}

export function markMastered(
  db: DrizzleD1Database,
  playerId: string,
  unitIds: string[],
): Promise<Result<void, InfraError>> {
  return upsertLore(db, playerId, unitIds, true);
}

function logLoreError(label: string, promise: Promise<Result<void, InfraError>>): void {
  void promise
    .then((r) => {
      if (r.isErr()) logError(label, r.error);
    })
    .catch((error: unknown) => logError(label, error));
}

export function markSeenAsync(
  db: DrizzleD1Database,
  playerId: string,
  unitIds: string[],
  label: string,
): void {
  logLoreError(label, markSeen(db, playerId, unitIds));
}

export function markMasteredAsync(
  db: DrizzleD1Database,
  playerId: string,
  unitIds: string[],
  label: string,
): void {
  logLoreError(label, markMastered(db, playerId, unitIds));
}
