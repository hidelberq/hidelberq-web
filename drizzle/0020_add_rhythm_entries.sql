DROP TABLE IF EXISTS `rhythm_entries`;

CREATE TABLE `rhythm_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`activity` text NOT NULL,
	`mood` integer NOT NULL,
	`interpersonal` integer NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
