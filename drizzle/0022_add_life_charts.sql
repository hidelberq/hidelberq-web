CREATE TABLE `life_charts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` text NOT NULL,
	`name` text DEFAULT 'マイライフチャート' NOT NULL,
	`birth_year` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `life_chart_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chart_id` integer NOT NULL,
	`age` integer NOT NULL,
	`score` integer NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
