CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`reply` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_access` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
