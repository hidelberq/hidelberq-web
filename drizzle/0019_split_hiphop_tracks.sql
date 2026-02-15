-- hiphop_tracks テーブルを再構築: instrumental/rap を別レコードに分離
-- type カラム追加、instrumentalKey/rapTrackKey を r2Key に統合

CREATE TABLE `hiphop_tracks_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`r2_key` text,
	`backup_url` text,
	`title` text,
	`prompt` text,
	`style` text,
	`duration` integer,
	`diary_content` text,
	`source` text NOT NULL,
	`suno_task_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
-- 既存の instrumental データを移行
INSERT INTO `hiphop_tracks_new` (`date`, `type`, `r2_key`, `backup_url`, `title`, `prompt`, `style`, `duration`, `diary_content`, `source`, `suno_task_id`, `created_at`)
SELECT `date`, 'instrumental', `instrumental_key`, `instrumental_url`, `title`, `prompt`, `style`, `duration`, `diary_content`, `source`, `suno_task_id`, `created_at`
FROM `hiphop_tracks`
WHERE `instrumental_key` IS NOT NULL;
--> statement-breakpoint
-- 既存の rap データを移行
INSERT INTO `hiphop_tracks_new` (`date`, `type`, `r2_key`, `backup_url`, `title`, `prompt`, `style`, `duration`, `diary_content`, `source`, `suno_task_id`, `created_at`)
SELECT `date`, 'rap', `rap_track_key`, NULL, `title`, NULL, NULL, NULL, NULL, COALESCE(`source`, 'manual'), NULL, `created_at`
FROM `hiphop_tracks`
WHERE `rap_track_key` IS NOT NULL;
--> statement-breakpoint
DROP TABLE `hiphop_tracks`;
--> statement-breakpoint
ALTER TABLE `hiphop_tracks_new` RENAME TO `hiphop_tracks`;
--> statement-breakpoint
CREATE UNIQUE INDEX `hiphop_tracks_date_type_unique` ON `hiphop_tracks` (`date`, `type`);
