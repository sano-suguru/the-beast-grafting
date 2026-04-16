import { createClient } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { DELETE_ORDER, loadMigrationSql, validateDeleteOrder, type TestDb } from "./test-db-base";

export type { TestDb } from "./test-db-base";

let singleton: TestDb | undefined;

async function createLibsqlTestDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.executeMultiple(loadMigrationSql());
  // LibSQLDatabase and DrizzleD1Database share the same async BaseSQLiteDatabase base.
  // All production code uses Drizzle's query builder — never raw D1 API — so the cast is safe.
  const db = drizzleLibsql(client) as unknown as DrizzleD1Database;

  return {
    db,
    async clean() {
      // Safe: table names come from the DELETE_ORDER const tuple, not user input.
      await client.batch(DELETE_ORDER.map((t) => `DELETE FROM "${t}"`));
    },
    async dispose() {
      client.close();
    },
  };
}

export async function getTestDb(): Promise<TestDb> {
  if (singleton) return singleton;
  validateDeleteOrder();
  if (process.env["USE_MINIFLARE"]) {
    /* oxlint-disable-next-line eslint-js/no-restricted-syntax -- lazy-load Miniflare to avoid 6.7s import overhead in the default path */
    const mod = await import("./test-db-miniflare");
    singleton = await mod.createMiniflareTestDb();
  } else {
    singleton = await createLibsqlTestDb();
  }
  return singleton;
}
