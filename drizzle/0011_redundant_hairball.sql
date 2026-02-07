CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
