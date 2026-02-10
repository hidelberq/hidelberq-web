PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_book_member_statuses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`member_id` text NOT NULL,
	`member_name` text NOT NULL,
	`status` text DEFAULT 'tsundoku' NOT NULL,
	`difficulty` integer,
	`importance` integer,
	`recommendation` integer,
	`memo` text,
	`started_at` text,
	`completed_at` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
INSERT INTO `__new_book_member_statuses`("id", "book_id", "member_id", "member_name", "status", "difficulty", "importance", "recommendation", "memo", "started_at", "completed_at", "updated_at") SELECT "id", "book_id", "member_id", "member_name", "status", "difficulty", "importance", "recommendation", "memo", "started_at", "completed_at", "updated_at" FROM `book_member_statuses`;--> statement-breakpoint
UPDATE `__new_book_member_statuses` SET `status` = 'wishlist' WHERE `status` IN ('unowned', 'interested');--> statement-breakpoint
DROP TABLE `book_member_statuses`;--> statement-breakpoint
ALTER TABLE `__new_book_member_statuses` RENAME TO `book_member_statuses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_personal_books` (
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
	`status` text DEFAULT 'tsundoku' NOT NULL,
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
--> statement-breakpoint
INSERT INTO `__new_personal_books`("id", "member_id", "member_name", "google_books_id", "title", "author", "isbn", "published_year", "publisher", "cover_image_url", "description", "page_count", "genre", "status", "difficulty", "importance", "recommendation", "visibility", "memo", "started_at", "completed_at", "tags", "created_at", "updated_at") SELECT "id", "member_id", "member_name", "google_books_id", "title", "author", "isbn", "published_year", "publisher", "cover_image_url", "description", "page_count", "genre", "status", "difficulty", "importance", "recommendation", "visibility", "memo", "started_at", "completed_at", "tags", "created_at", "updated_at" FROM `personal_books`;--> statement-breakpoint
UPDATE `__new_personal_books` SET `status` = 'wishlist' WHERE `status` IN ('unowned', 'interested');--> statement-breakpoint
DROP TABLE `personal_books`;--> statement-breakpoint
ALTER TABLE `__new_personal_books` RENAME TO `personal_books`;