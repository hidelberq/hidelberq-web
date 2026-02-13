CREATE TABLE `hiphop_tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`instrumental_key` text,
	`instrumental_url` text,
	`rap_track_key` text,
	`title` text,
	`prompt` text,
	`style` text,
	`duration` integer,
	`diary_content` text,
	`source` text NOT NULL,
	`suno_task_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hiphop_tracks_date_unique` ON `hiphop_tracks` (`date`);