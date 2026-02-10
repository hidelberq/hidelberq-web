CREATE TABLE `user_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` text NOT NULL,
	`display_name` text NOT NULL,
	`bio` text,
	`favorite_genre` text,
	`avatar_emoji` text DEFAULT '📚' NOT NULL,
	`is_public` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_profiles_member_id_unique` ON `user_profiles` (`member_id`);