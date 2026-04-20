CREATE TABLE `auth_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_id` text NOT NULL,
	`credential` text,
	`credential_salt` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_auth_providers_unique` ON `auth_providers` (`provider`,`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_auth_providers_player_id` ON `auth_providers` (`player_id`);--> statement-breakpoint
CREATE TABLE `battles` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`run_id` text NOT NULL,
	`opponent_player_id` text,
	`night` integer NOT NULL,
	`seed` integer NOT NULL,
	`opponent` text NOT NULL,
	`result` text NOT NULL,
	`consumed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opponent_player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_battles_run_night` ON `battles` (`run_id`,`night`);--> statement-breakpoint
CREATE INDEX `idx_battles_run_player_night` ON `battles` (`run_id`,`player_id`,`night`);--> statement-breakpoint
CREATE INDEX `idx_battles_player_id` ON `battles` (`player_id`);--> statement-breakpoint
CREATE INDEX `idx_battles_created_at` ON `battles` (`created_at`);--> statement-breakpoint
CREATE TABLE `board_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`run_id` text NOT NULL,
	`night` integer NOT NULL,
	`board` text NOT NULL,
	`life` integer NOT NULL,
	`trophy` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_snapshots_run_night` ON `board_snapshots` (`run_id`,`night`);--> statement-breakpoint
CREATE INDEX `idx_snapshots_night` ON `board_snapshots` (`night`);--> statement-breakpoint
CREATE INDEX `idx_snapshots_player_id` ON `board_snapshots` (`player_id`);--> statement-breakpoint
CREATE INDEX `idx_snapshots_created_at` ON `board_snapshots` (`created_at`);--> statement-breakpoint
CREATE TABLE `lore_entries` (
	`player_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`seen_at` integer NOT NULL,
	`mastered_at` integer,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_lore_entries_pk` ON `lore_entries` (`player_id`,`unit_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`window_start` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`night` integer DEFAULT 1 NOT NULL,
	`life` integer DEFAULT 5 NOT NULL,
	`trophy` integer DEFAULT 0 NOT NULL,
	`board` text NOT NULL,
	`origin_id` text,
	`shop_seed` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_runs_created_at` ON `runs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_runs_player_id` ON `runs` (`player_id`);--> statement-breakpoint
CREATE INDEX `idx_runs_status` ON `runs` (`status`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_player_id` ON `sessions` (`player_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `shop_states` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`night` integer NOT NULL,
	`blood` integer DEFAULT 10 NOT NULL,
	`free_roll` integer DEFAULT false NOT NULL,
	`cultist_used` integer DEFAULT false NOT NULL,
	`rot_ring_uses` integer DEFAULT 0 NOT NULL,
	`bone_tree_uses` integer DEFAULT 0 NOT NULL,
	`corpse_broker_uses` integer DEFAULT 0 NOT NULL,
	`shop_units` text NOT NULL,
	`shop_items` text NOT NULL,
	`board` text NOT NULL,
	`active_event` text,
	`rng_s0` integer NOT NULL,
	`rng_s1` integer NOT NULL,
	`reward_slots` text DEFAULT '[]' NOT NULL,
	`undo_snapshot` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_shop_states_run_night` ON `shop_states` (`run_id`,`night`);--> statement-breakpoint
CREATE INDEX `idx_shop_states_run_id` ON `shop_states` (`run_id`);