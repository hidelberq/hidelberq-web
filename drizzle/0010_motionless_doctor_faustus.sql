CREATE TABLE `scrape_sites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`site_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`parser_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scrape_sites_site_id_unique` ON `scrape_sites` (`site_id`);
--> statement-breakpoint
INSERT INTO `scrape_sites` (`site_id`, `name`, `url`, `parser_id`, `enabled`) VALUES ('yahoo-top', 'Yahoo!ニュース トピックス', 'https://news.yahoo.co.jp/topics', 'yahoo-top', 1);