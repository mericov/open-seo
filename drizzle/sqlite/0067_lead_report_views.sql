ALTER TABLE `leads` ADD `report_views` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `report_last_viewed_at` text;