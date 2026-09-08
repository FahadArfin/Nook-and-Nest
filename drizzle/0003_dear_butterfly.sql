CREATE TABLE `shared_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`document` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shared_plans_owner_idx` ON `shared_plans` (`owner_id`);