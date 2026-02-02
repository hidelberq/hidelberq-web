CREATE TABLE `shogi_games` (
	`id` text PRIMARY KEY NOT NULL,
	`board` text NOT NULL,
	`captured` text NOT NULL,
	`current_player` text DEFAULT 'sente' NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`winner` text,
	`sente_player_id` text,
	`gote_player_id` text,
	`move_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
