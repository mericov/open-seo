ALTER TABLE `lead_email_templates` ADD `step` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `follow_up_step` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `follow_up_sent_at` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `follow_up_stopped_at` text;--> statement-breakpoint
UPDATE `leads` SET `follow_up_step` = 1, `follow_up_sent_at` = `contacted_at` WHERE `outreach_status` = 'contacted' AND `contacted_at` IS NOT NULL;