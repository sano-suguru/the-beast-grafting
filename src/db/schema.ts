import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    round: integer("round").notNull().default(1),
    board: text("board", { mode: "json" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("idx_runs_created_at").on(table.createdAt)],
);
