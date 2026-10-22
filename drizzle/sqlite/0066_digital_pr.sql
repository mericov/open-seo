CREATE TABLE `media_articles` (
	`id` text PRIMARY KEY NOT NULL,
	`outlet_id` text NOT NULL,
	`contact_id` text,
	`topic_id` text,
	`url` text NOT NULL,
	`title` text,
	`published_at` text,
	`author_name` text,
	`author_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`outlet_id`) REFERENCES `media_outlets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `media_contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`topic_id`) REFERENCES `media_topics`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_articles_outlet_url_unique` ON `media_articles` (`outlet_id`,`url`);--> statement-breakpoint
CREATE INDEX `media_articles_author_status_idx` ON `media_articles` (`author_status`,`created_at`);--> statement-breakpoint
CREATE INDEX `media_articles_contact_idx` ON `media_articles` (`contact_id`);--> statement-breakpoint
CREATE TABLE `media_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`outlet_id` text NOT NULL,
	`contact_key` text NOT NULL,
	`name` text,
	`email` text,
	`job_title` text,
	`role` text NOT NULL,
	`source` text NOT NULL,
	`article_count` integer DEFAULT 0 NOT NULL,
	`last_article_at` text,
	`edited_at` text,
	`hidden_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`outlet_id`) REFERENCES `media_outlets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_contacts_outlet_key_unique` ON `media_contacts` (`outlet_id`,`contact_key`);--> statement-breakpoint
CREATE TABLE `media_outlet_topics` (
	`outlet_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`last_seen_at` text NOT NULL,
	PRIMARY KEY(`outlet_id`, `topic_id`),
	FOREIGN KEY (`outlet_id`) REFERENCES `media_outlets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `media_topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_outlet_topics_topic_idx` ON `media_outlet_topics` (`topic_id`);--> statement-breakpoint
CREATE TABLE `media_outlets` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`domain` text NOT NULL,
	`name` text,
	`type` text DEFAULT 'other' NOT NULL,
	`market` text NOT NULL,
	`source` text NOT NULL,
	`homepage_url` text,
	`masthead_url` text,
	`contact_page_url` text,
	`organic_traffic` integer,
	`domain_rank` integer,
	`enrich_status` text DEFAULT 'pending' NOT NULL,
	`enrich_claimed_at` text,
	`enriched_at` text,
	`notes` text,
	`edited_at` text,
	`hidden_at` text,
	`last_seen_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_outlets_org_domain_unique` ON `media_outlets` (`organization_id`,`domain`);--> statement-breakpoint
CREATE INDEX `media_outlets_enrich_idx` ON `media_outlets` (`enrich_status`,`created_at`);--> statement-breakpoint
CREATE TABLE `media_scan_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`topics_scanned` integer DEFAULT 0 NOT NULL,
	`outlets_found` integer DEFAULT 0 NOT NULL,
	`outlets_added` integer DEFAULT 0 NOT NULL,
	`articles_added` integer DEFAULT 0 NOT NULL,
	`error` text,
	`started_at` text NOT NULL,
	`finished_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_scan_runs_org_started_idx` ON `media_scan_runs` (`organization_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `media_scan_settings` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`auto_run` integer DEFAULT false NOT NULL,
	`next_run_at` text,
	`last_run_at` text,
	`running_run_id` text,
	`run_started_at` text,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `media_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`keyword` text NOT NULL,
	`market` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_topics_org_market_keyword_unique` ON `media_topics` (`organization_id`,`market`,`keyword`);--> statement-breakpoint
CREATE TABLE `pr_email_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`language` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pr_email_templates_project_idx` ON `pr_email_templates` (`project_id`);--> statement-breakpoint
CREATE TABLE `pr_gap_competitors` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`domain` text NOT NULL,
	`position` integer NOT NULL,
	`referring_domains` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `pr_gap_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pr_gap_competitors_run_domain_unique` ON `pr_gap_competitors` (`run_id`,`domain`);--> statement-breakpoint
CREATE TABLE `pr_gap_domain_hits` (
	`gap_domain_id` text NOT NULL,
	`competitor_id` text NOT NULL,
	`backlinks` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`gap_domain_id`, `competitor_id`),
	FOREIGN KEY (`gap_domain_id`) REFERENCES `pr_gap_domains`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`competitor_id`) REFERENCES `pr_gap_competitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pr_gap_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`domain` text NOT NULL,
	`rank` integer,
	`competitor_count` integer NOT NULL,
	`backlinks` integer DEFAULT 0 NOT NULL,
	`spam_score` real,
	`first_seen` text,
	`hidden_at` text,
	FOREIGN KEY (`run_id`) REFERENCES `pr_gap_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pr_gap_domains_run_domain_unique` ON `pr_gap_domains` (`run_id`,`domain`);--> statement-breakpoint
CREATE TABLE `pr_gap_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`own_domain` text NOT NULL,
	`total_domains` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pr_gap_runs_project_created_idx` ON `pr_gap_runs` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `pr_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`outlet_id` text NOT NULL,
	`contact_id` text,
	`target_key` text NOT NULL,
	`source` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`pitch` text,
	`note_text` text,
	`remind_at` text,
	`contacted_at` text,
	`hidden_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`outlet_id`) REFERENCES `media_outlets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `media_contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pr_targets_project_key_unique` ON `pr_targets` (`project_id`,`target_key`);--> statement-breakpoint
CREATE INDEX `pr_targets_project_status_idx` ON `pr_targets` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `pr_targets_contact_idx` ON `pr_targets` (`contact_id`);--> statement-breakpoint
CREATE INDEX `pr_targets_outlet_idx` ON `pr_targets` (`outlet_id`);