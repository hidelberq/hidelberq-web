CREATE TABLE `scraped_articles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`site_id` text NOT NULL,
	`site_name` text NOT NULL,
	`site_url` text NOT NULL,
	`article_url` text NOT NULL,
	`article_title` text NOT NULL,
	`image_url` text,
	`description` text,
	`category` text,
	`scraped_at` integer NOT NULL,
	`used_for_tweet` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scraped_articles_article_url_unique` ON `scraped_articles` (`article_url`);