import type { DrizzleD1Database } from "drizzle-orm/d1";
import { getTableName, is, Table } from "drizzle-orm";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { invariant } from "../shared/invariant";
import * as schema from "../db/schema";

const DRIZZLE_DIR = resolve(import.meta.dirname, "../../drizzle");

// FK-safe deletion order: children before parents
export const DELETE_ORDER = [
  "shop_states",
  "board_snapshots",
  "battles",
  "lore_entries",
  "sessions",
  "auth_providers",
  "runs",
  "rate_limits",
  "players",
] as const;

export interface TestDb {
  db: DrizzleD1Database;
  clean: () => Promise<void>;
  dispose: () => Promise<void>;
}

export function validateDeleteOrder(): void {
  const schemaTableNames = new Set(
    Object.values(schema)
      .filter((v) => is(v, Table))
      .map((v) => getTableName(v as Table)),
  );
  for (const name of schemaTableNames) {
    invariant(
      (DELETE_ORDER as readonly string[]).includes(name),
      `DELETE_ORDER is missing table: ${name}`,
    );
  }
  for (const name of DELETE_ORDER) {
    invariant(schemaTableNames.has(name), `DELETE_ORDER has stale table: ${name}`);
  }
}

export function loadMigrationSql(): string {
  const files = readdirSync(DRIZZLE_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  invariant(files.length > 0, "no migration SQL files found in drizzle/");
  return files.map((f) => readFileSync(resolve(DRIZZLE_DIR, f), "utf-8")).join("\n");
}
