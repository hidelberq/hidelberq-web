CREATE TABLE `note` (
	`note_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`note_user_name` text NOT NULL,
	`url` text NOT NULL,
	`thumbnail_url` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `youtube` (
	`youtube_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`channel_name` text NOT NULL,
	`duration` text NOT NULL,
	`is_public` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
