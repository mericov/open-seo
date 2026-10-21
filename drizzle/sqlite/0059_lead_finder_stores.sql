ALTER TABLE `lead_searches` ADD `source` text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE `lead_searches` ADD `country_code` text;--> statement-breakpoint
ALTER TABLE `lead_searches` ADD `keyword_query` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `country_code` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `domain_rank` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `product_count` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `last_product_at` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `currency` text;