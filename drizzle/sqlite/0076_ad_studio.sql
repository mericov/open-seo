CREATE TABLE `ad_competitor_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`page_id` text NOT NULL,
	`page_name` text NOT NULL,
	`domain` text,
	`kind` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ad_competitor_pages_project_page_idx` ON `ad_competitor_pages` (`project_id`,`page_id`);--> statement-breakpoint
CREATE TABLE `ad_draft_media` (
	`draft_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`draft_id`, `asset_id`),
	FOREIGN KEY (`draft_id`) REFERENCES `ad_drafts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `social_media_assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ad_draft_media_asset_idx` ON `ad_draft_media` (`asset_id`);--> statement-breakpoint
CREATE TABLE `ad_draft_variations` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`field` text NOT NULL,
	`position` integer NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `ad_drafts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ad_draft_variations_draft_idx` ON `ad_draft_variations` (`draft_id`,`field`);--> statement-breakpoint
CREATE TABLE `ad_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`name` text NOT NULL,
	`angle` text,
	`script` text,
	`cta` text NOT NULL,
	`landing_url` text NOT NULL,
	`tracked_url` text NOT NULL,
	`target_keyword` text,
	`source_type` text,
	`source_title` text,
	`source_url` text,
	`inspiration` text,
	`context_notes` text,
	`meta_campaign_id` text,
	`meta_ad_set_id` text,
	`meta_creative_id` text,
	`meta_ad_id` text,
	`error_message` text,
	`created_by` text NOT NULL,
	`approved_at` text,
	`sent_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ad_drafts_project_updated_idx` ON `ad_drafts` (`project_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `competitor_ads` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`library_id` text NOT NULL,
	`page_id` text NOT NULL,
	`page_name` text NOT NULL,
	`country` text,
	`snapshot_url` text NOT NULL,
	`headline` text,
	`body` text,
	`description` text,
	`cta` text,
	`format` text DEFAULT 'unknown' NOT NULL,
	`hook` text,
	`angle` text,
	`offer` text,
	`media_url` text,
	`transcript` text,
	`scene_summary` text,
	`started_at` text,
	`stopped_at` text,
	`last_seen_at` text NOT NULL,
	`active` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competitor_ads_project_library_idx` ON `competitor_ads` (`project_id`,`library_id`);--> statement-breakpoint
CREATE INDEX `competitor_ads_project_page_idx` ON `competitor_ads` (`project_id`,`page_id`);