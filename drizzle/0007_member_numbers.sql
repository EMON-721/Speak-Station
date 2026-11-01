CREATE TABLE `member_numbers` (
 `member_number` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
 `user_id` text NOT NULL UNIQUE
);
--> statement-breakpoint
INSERT OR IGNORE INTO member_numbers (user_id) SELECT user_id FROM profiles ORDER BY created_at ASC, user_id ASC;
