CREATE TABLE `inbound_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`source` text,
	`locale` text,
	`page` text,
	`name` text,
	`email` text,
	`phone` text,
	`website` text,
	`message` text,
	`seconds_on_page` integer,
	`verdict` text DEFAULT 'ok' NOT NULL,
	`reason` text,
	`status` text DEFAULT 'new' NOT NULL,
	`note` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inbound_leads_project_created_idx` ON `inbound_leads` (`project_id`,`created_at`);