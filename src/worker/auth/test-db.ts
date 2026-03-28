import Database from "better-sqlite3";
import { drizzle as drizzleBetterSqlite } from "drizzle-orm/better-sqlite3";
import type { BatchItem } from "drizzle-orm/batch";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { invariant } from "../../shared/invariant";

const DRIZZLE_DIR = resolve(import.meta.dirname, "../../../drizzle");

function loadMigrationSql(): string {
  const files = readdirSync(DRIZZLE_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  invariant(files.length > 0, "no migration SQL files found in drizzle/");
  return files.map((f) => readFileSync(resolve(DRIZZLE_DIR, f), "utf-8")).join("\n");
}

export function createTestDb(): DrizzleD1Database {
  const sqlite = new Database(":memory:");
  const sql = loadMigrationSql();

  for (const stmt of sql.split("--> statement-breakpoint")) {
    const trimmed = stmt.trim();
    if (trimmed) sqlite.exec(trimmed);
  }

  // better-sqlite3 drizzle は D1 drizzle と実行時互換だが TS 型が別系統のため unknown 経由でキャスト
  const db = drizzleBetterSqlite(sqlite) as unknown as DrizzleD1Database;

  const original = db as unknown as Record<string, unknown>;
  original["batch"] = async (stmts: BatchItem<"sqlite">[]) => {
    const promises: Promise<unknown>[] = [];
    sqlite.transaction(() => {
      for (const stmt of stmts) {
        promises.push(Promise.resolve(stmt as unknown as PromiseLike<unknown>));
      }
    })();
    return Promise.all(promises);
  };

  return db;
}
