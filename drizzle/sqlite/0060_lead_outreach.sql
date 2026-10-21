CREATE TABLE `lead_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`code` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_findings_lead_code_unique` ON `lead_findings` (`lead_id`,`code`);--> statement-breakpoint
ALTER TABLE `leads` ADD `opportunity_score` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `outreach_status` text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `contacted_at` text;--> statement-breakpoint
CREATE INDEX `leads_project_outreach_idx` ON `leads` (`project_id`,`outreach_status`);