import { Miniflare } from "miniflare";
import { drizzle } from "drizzle-orm/d1";
import { DELETE_ORDER, loadMigrationSql, type TestDb } from "./test-db-base";

export async function createMiniflareTestDb(): Promise<TestDb> {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    d1Databases: { DB: "test-db" },
  });
  const d1 = await mf.getD1Database("DB");
  for (const stmt of loadMigrationSql().split("--> statement-breakpoint")) {
    const trimmed = stmt.trim();
    if (trimmed) await d1.prepare(trimmed).run();
  }
  const db = drizzle(d1);

  return {
    db,
    async clean() {
      await d1.batch(DELETE_ORDER.map((t) => d1.prepare(`DELETE FROM "${t}"`)));
    },
    async dispose() {
      await mf.dispose();
    },
  };
}
