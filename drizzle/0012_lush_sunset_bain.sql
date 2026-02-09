CREATE TABLE `book_group_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`member_id` text NOT NULL,
	`display_name` text NOT NULL,
	`joined_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `book_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_by_member_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `book_groups_group_code_unique` ON `book_groups` (`group_code`);--> statement-breakpoint
CREATE TABLE `book_member_statuses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`member_id` text NOT NULL,
	`member_name` text NOT NULL,
	`status` text DEFAULT 'interested' NOT NULL,
	`difficulty` integer,
	`importance` integer,
	`recommendation` integer,
	`memo` text,
	`started_at` text,
	`completed_at` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `book_prerequisites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`personal_book_id` integer NOT NULL,
	`prerequisite_personal_book_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`isbn` text,
	`published_year` text,
	`publisher` text,
	`cover_image_url` text,
	`description` text,
	`page_count` integer,
	`genre` text,
	`added_by_member_id` text NOT NULL,
	`added_by_name` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `personal_books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` text NOT NULL,
	`member_name` text NOT NULL,
	`google_books_id` text,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`isbn` text,
	`published_year` text,
	`publisher` text,
	`cover_image_url` text,
	`description` text,
	`page_count` integer,
	`genre` text,
	`status` text DEFAULT 'interested' NOT NULL,
	`difficulty` integer,
	`importance` integer,
	`recommendation` integer,
	`visibility` text DEFAULT 'public' NOT NULL,
	`memo` text,
	`started_at` text,
	`completed_at` text,
	`tags` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
