CREATE TABLE `book_prerequisites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`personal_book_id` integer NOT NULL,
	`prerequisite_personal_book_id` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
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
