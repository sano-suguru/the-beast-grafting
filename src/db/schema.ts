import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { BoardUnit, PvpOpponent } from "../shared/board-unit";
import type { ShopSlotJson, ShopItemSlotJson, ShopUndoSnapshot } from "./shop-state-types";
import type { EventData } from "../shared/types";

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

export const boardSnapshots = sqliteTable(
  "board_snapshots",
  {
    id: text("id").primaryKey(),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    round: integer("round").notNull(),
    board: text("board", { mode: "json" }).$type<BoardUnit[]>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_snapshots_run_round").on(table.runId, table.round),
    index("idx_snapshots_round").on(table.round),
    index("idx_snapshots_player_id").on(table.playerId),
    index("idx_snapshots_created_at").on(table.createdAt),
  ],
);

export const battles = sqliteTable(
  "battles",
  {
    id: text("id").primaryKey(),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    opponentPlayerId: text("opponent_player_id").references(() => players.id),
    round: integer("round").notNull(),
    seed: integer("seed").notNull(),
    opponent: text("opponent", { mode: "json" }).$type<PvpOpponent>().notNull(),
    result: text("result", { enum: ["WIN", "LOSE", "DRAW"] }).notNull(),
    consumed: integer("consumed", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_battles_run_round").on(table.runId, table.round),
    index("idx_battles_player_id").on(table.playerId),
    index("idx_battles_created_at").on(table.createdAt),
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
    sanity: integer("sanity").notNull().default(5),
    trophy: integer("trophy").notNull().default(0),
    board: text("board", { mode: "json" }).$type<(BoardUnit | null)[]>().notNull(),
    originId: text("origin_id"),
    shopSeed: integer("shop_seed"),
    status: text("status", { enum: ["active", "won", "lost", "retired"] })
      .notNull()
      .default("active"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_runs_created_at").on(table.createdAt),
    index("idx_runs_player_id").on(table.playerId),
    index("idx_runs_status").on(table.status),
  ],
);

export const shopStates = sqliteTable(
  "shop_states",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    round: integer("round").notNull(),
    blood: integer("blood").notNull().default(10),
    freeRoll: integer("free_roll", { mode: "boolean" }).notNull().default(false),
    cultistUsed: integer("cultist_used", { mode: "boolean" }).notNull().default(false),
    rotRingUses: integer("rot_ring_uses").notNull().default(0),
    shopUnits: text("shop_units", { mode: "json" }).$type<(ShopSlotJson | null)[]>().notNull(),
    shopItems: text("shop_items", { mode: "json" }).$type<(ShopItemSlotJson | null)[]>().notNull(),
    board: text("board", { mode: "json" }).$type<(BoardUnit | null)[]>().notNull(),
    activeEvent: text("active_event", { mode: "json" }).$type<EventData | null>(),
    rngS0: integer("rng_s0").notNull(),
    rngS1: integer("rng_s1").notNull(),
    rewardSlots: text("reward_slots", { mode: "json" })
      .$type<(ShopSlotJson | null)[]>()
      .notNull()
      .default([]),
    undoSnapshot: text("undo_snapshot", { mode: "json" }).$type<ShopUndoSnapshot | null>(),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_shop_states_run_round").on(table.runId, table.round),
    index("idx_shop_states_run_id").on(table.runId),
  ],
);
