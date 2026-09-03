CREATE TABLE `project_versions` (
	`owner_id` text NOT NULL,
	`project_id` text NOT NULL,
	`revision` integer NOT NULL,
	`name` text NOT NULL,
	`saved_at` text NOT NULL,
	`document` text NOT NULL,
	PRIMARY KEY(`owner_id`, `project_id`, `revision`)
);
