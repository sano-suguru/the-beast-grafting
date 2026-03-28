import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const authProviders = sqliteTable(
  "auth_providers",
  {
    id: text("id").primaryKey(),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id),
    provider: text("provider").notNull(),
    providerId: text("provider_id").notNull(),
    credential: text("credential"),
    credentialSalt: text("credential_salt"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_auth_providers_unique").on(table.provider, table.providerId),
    index("idx_auth_providers_player_id").on(table.playerId),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_sessions_player_id").on(table.playerId),
    index("idx_sessions_expires_at").on(table.expiresAt),
  ],
);

export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id),
    round: integer("round").notNull().default(1),
    board: text("board", { mode: "json" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_runs_created_at").on(table.createdAt),
    index("idx_runs_player_id").on(table.playerId),
  ],
);
