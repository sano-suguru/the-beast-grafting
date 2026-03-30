import { lt } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { safeAsync, dbErr } from "../../shared/errors";
import type { Result, InfraError } from "../../shared/errors";
import { boardSnapshots } from "../../db/schema";

const SNAPSHOT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function cleanOldSnapshots(db: DrizzleD1Database): Promise<Result<void, InfraError>> {
  const cutoff = new Date(Date.now() - SNAPSHOT_TTL_MS);
  return safeAsync(async () => {
    await db.delete(boardSnapshots).where(lt(boardSnapshots.createdAt, cutoff));
  }, dbErr);
}
