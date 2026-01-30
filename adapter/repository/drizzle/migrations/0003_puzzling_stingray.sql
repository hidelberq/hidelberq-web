ALTER TABLE `doc` ADD `posted_user_id` text DEFAULT 'mock-user-id' NOT NULL;--> statement-breakpoint
ALTER TABLE `note` ADD `posted_user_id` text DEFAULT 'mock-user-id' NOT NULL;--> statement-breakpoint
ALTER TABLE `youtube` ADD `posted_user_id` text DEFAULT 'mock-user-id' NOT NULL;