DROP TABLE IF EXISTS `memos`;--> statement-breakpoint
CREATE TABLE `tweets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text NOT NULL,
	`author_name` text NOT NULL,
	`author_handle` text NOT NULL,
	`author_emoji` text NOT NULL,
	`category` text NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`retweets` integer DEFAULT 0 NOT NULL,
	`replies` integer DEFAULT 0 NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`displayed` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
