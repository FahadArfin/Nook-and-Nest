CREATE TABLE `listing_video_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`request_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`provider_id` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`next_poll_at` integer DEFAULT 0 NOT NULL,
	`video_url` text,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `listing_video_owner_idx` ON `listing_video_jobs` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `listing_video_request_idx` ON `listing_video_jobs` (`owner_id`,`request_id`);--> statement-breakpoint
CREATE TABLE `listing_video_usage` (
	`scope` text NOT NULL,
	`day` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`scope`, `day`)
);
