CREATE TABLE `traffic_country_shares` (
	`organization_id` text NOT NULL,
	`domain` text NOT NULL,
	`location_code` integer NOT NULL,
	`language_code` text NOT NULL,
	`organic_traffic` real,
	`organic_keywords` integer,
	`paid_traffic` real,
	`paid_keywords` integer,
	PRIMARY KEY(`organization_id`, `domain`, `location_code`, `language_code`),
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `traffic_domain_snapshots` (
	`organization_id` text NOT NULL,
	`domain` text NOT NULL,
	`countries_fetched_at` text,
	`backlinks` integer,
	`referring_domains` integer,
	`domain_rank` integer,
	`backlinks_fetched_at` text,
	PRIMARY KEY(`organization_id`, `domain`),
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `traffic_history_fetches` (
	`organization_id` text NOT NULL,
	`domain` text NOT NULL,
	`location_code` integer NOT NULL,
	`language_code` text NOT NULL,
	`covered_from` text NOT NULL,
	`last_fetched_at` text NOT NULL,
	PRIMARY KEY(`organization_id`, `domain`, `location_code`, `language_code`),
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `traffic_history_months` (
	`organization_id` text NOT NULL,
	`domain` text NOT NULL,
	`location_code` integer NOT NULL,
	`language_code` text NOT NULL,
	`month` text NOT NULL,
	`organic_traffic` real,
	`organic_keywords` integer,
	`organic_traffic_cost` real,
	`paid_traffic` real,
	`paid_keywords` integer,
	`paid_traffic_cost` real,
	PRIMARY KEY(`organization_id`, `domain`, `location_code`, `language_code`, `month`),
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `traffic_history_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`domain` text NOT NULL,
	`month` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `traffic_history_notes_org_domain_idx` ON `traffic_history_notes` (`organization_id`,`domain`);--> statement-breakpoint
CREATE TABLE `traffic_history_positions` (
	`organization_id` text NOT NULL,
	`domain` text NOT NULL,
	`location_code` integer NOT NULL,
	`language_code` text NOT NULL,
	`month` text NOT NULL,
	`kind` text NOT NULL,
	`band` text NOT NULL,
	`keywords` integer NOT NULL,
	PRIMARY KEY(`organization_id`, `domain`, `location_code`, `language_code`, `month`, `kind`, `band`),
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
