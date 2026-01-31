CREATE TABLE `news_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text NOT NULL,
	`fetched_date` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
ALTER TABLE `tweets` DROP COLUMN `search_keyword`;