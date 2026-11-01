CREATE TABLE `question_cooldowns` (
 `user_id` text NOT NULL,
 `question_id` text NOT NULL,
 `available_at` text NOT NULL,
 PRIMARY KEY (`user_id`,`question_id`)
);
--> statement-breakpoint
CREATE INDEX `question_cooldowns_expiration_idx` ON `question_cooldowns` (`available_at`);
