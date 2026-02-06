CREATE TABLE `hero_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`image_key` text NOT NULL,
	`prompt` text NOT NULL,
	`source` text NOT NULL,
	`diary_content` text,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hero_images_date_unique` ON `hero_images` (`date`);