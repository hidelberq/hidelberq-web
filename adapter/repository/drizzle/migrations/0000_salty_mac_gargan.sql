CREATE TABLE `doc` (
	`doc_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`status` text NOT NULL,
	`body` text NOT NULL,
	`thumbnail_url` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_created_at` ON `doc` (`created_at`);--> statement-breakpoint
CREATE TABLE `video` (
	`video_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`channel_name` text NOT NULL,
	`duration` text NOT NULL,
	`is_public` integer NOT NULL,
	`uploaded_at` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_video_created_at` ON `video` (`created_at`);