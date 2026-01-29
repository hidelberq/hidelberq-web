PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tweets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text NOT NULL,
	`author_name` text NOT NULL,
	`author_handle` text NOT NULL,
	`author_emoji` text NOT NULL,
	`category` text NOT NULL,
	`source_url` text NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`retweets` integer DEFAULT 0 NOT NULL,
	`replies` integer DEFAULT 0 NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`displayed` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
INSERT INTO `__new_tweets`("id", "content", "author_name", "author_handle", "author_emoji", "category", "source_url", "likes", "retweets", "replies", "views", "displayed", "created_at") SELECT "id", "content", "author_name", "author_handle", "author_emoji", "category", "source_url", "likes", "retweets", "replies", "views", "displayed", "created_at" FROM `tweets`;--> statement-breakpoint
DROP TABLE `tweets`;--> statement-breakpoint
ALTER TABLE `__new_tweets` RENAME TO `tweets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;