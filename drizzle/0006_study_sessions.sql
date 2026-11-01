CREATE TABLE `study_sessions` (
 `id` text PRIMARY KEY NOT NULL,
 `user_id` text NOT NULL,
 `category` text NOT NULL,
 `kind` text NOT NULL,
 `day` integer NOT NULL,
 `mode` text NOT NULL,
 `started_at` text NOT NULL,
 `expires_at` text NOT NULL,
 `completed_at` text
);
--> statement-breakpoint
CREATE INDEX `study_sessions_user_category_start_idx` ON `study_sessions` (`user_id`,`category`,`started_at`);
