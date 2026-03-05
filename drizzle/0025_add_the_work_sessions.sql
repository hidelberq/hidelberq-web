CREATE TABLE `the_work_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` text NOT NULL,
	`title` text NOT NULL,
	`worksheet` text NOT NULL,
	`selected_belief` text,
	`four_questions` text,
	`turnaround` text,
	`step` text DEFAULT 'worksheet' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
