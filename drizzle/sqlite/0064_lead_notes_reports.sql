ALTER TABLE `leads` ADD `hidden_at` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `note_color` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `note_text` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `note_updated_at` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `remind_at` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `report_token` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `report_created_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `leads_report_token_unique` ON `leads` (`report_token`);