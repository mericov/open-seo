ALTER TABLE `lead_searches` ADD `category_group` text;--> statement-breakpoint
ALTER TABLE `lead_searches` ADD `need_filter` text;--> statement-breakpoint
ALTER TABLE `lead_searches` ADD `technology` text;--> statement-breakpoint
ALTER TABLE `lead_searches` ADD `min_rating` real;--> statement-breakpoint
ALTER TABLE `lead_searches` ADD `max_rank` integer;--> statement-breakpoint
ALTER TABLE `lead_searches` ADD `auto_run` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lead_searches` ADD `run_size` integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `lead_searches` ADD `next_offset` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `lead_searches` ADD `next_run_at` text;--> statement-breakpoint
ALTER TABLE `lead_searches` ADD `last_run_at` text;--> statement-breakpoint
CREATE INDEX `lead_searches_auto_run_idx` ON `lead_searches` (`auto_run`,`next_run_at`);--> statement-breakpoint
UPDATE lead_searches SET technology = 'Shopify' WHERE source = 'shopify' AND (keyword_query IS NOT NULL OR country_code IS NOT NULL);
