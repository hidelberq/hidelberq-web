CREATE TABLE `book_activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` text NOT NULL,
	`type` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`metadata` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `book_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` text NOT NULL,
	`personal_book_id` integer,
	`book_title` text NOT NULL,
	`book_author` text NOT NULL,
	`book_isbn` text,
	`book_cover_image_url` text,
	`title` text,
	`content` text NOT NULL,
	`rating` integer,
	`contains_spoiler` integer DEFAULT false NOT NULL,
	`likes_count` integer DEFAULT 0 NOT NULL,
	`comments_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
