CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`question_id` text NOT NULL,
	`kind` text DEFAULT 'free' NOT NULL,
	`day` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'recorded' NOT NULL,
	`transcript` text DEFAULT '' NOT NULL,
	`duration` integer NOT NULL,
	`audio_key` text NOT NULL,
	`mime` text NOT NULL,
	`feedback` text,
	`reviewed` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `days` (
	`user_id` text NOT NULL,
	`day` integer NOT NULL,
	`completed_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `day`)
);
--> statement-breakpoint
CREATE TABLE `question_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`target` text DEFAULT '8.0' NOT NULL,
	`track` integer DEFAULT 120 NOT NULL,
	`exam_date` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saved` (
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`key` text NOT NULL,
	`data` text NOT NULL,
	`reviewed` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `type`, `key`)
);
--> statement-breakpoint
CREATE TABLE `tests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`milestone` integer NOT NULL,
	`kind` text NOT NULL,
	`answers` text NOT NULL,
	`completed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `usage` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `date`)
);
