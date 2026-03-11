CREATE TABLE `youtube_videos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`published_at` text,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
