CREATE TABLE `meta_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`page_id` text,
	`page_name` text,
	`instagram_account_id` text,
	`instagram_username` text,
	`ad_account_id` text,
	`ad_account_name` text,
	`access_token` text NOT NULL,
	`timezone` text NOT NULL,
	`permissions` text,
	`last_tested_at` text,
	`last_test_ok` integer,
	`last_test_message` text,
	`connected_by_user_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meta_connections_project_idx` ON `meta_connections` (`project_id`);--> statement-breakpoint
CREATE TABLE `project_brand_kits` (
	`project_id` text PRIMARY KEY NOT NULL,
	`tone` text,
	`target_audience` text,
	`primary_color` text,
	`secondary_color` text,
	`accent_color` text,
	`heading_font` text,
	`body_font` text,
	`logo_url` text,
	`banned_phrases` text,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `social_media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`url` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`width` integer,
	`height` integer,
	`source` text NOT NULL,
	`source_url` text,
	`label` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `social_media_assets_project_created_idx` ON `social_media_assets` (`project_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `social_media_assets_r2_key_idx` ON `social_media_assets` (`r2_key`);--> statement-breakpoint
CREATE TABLE `social_post_media` (
	`post_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`post_id`, `asset_id`),
	FOREIGN KEY (`post_id`) REFERENCES `social_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `social_media_assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `social_post_media_asset_idx` ON `social_post_media` (`asset_id`);--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`platform` text NOT NULL,
	`format` text NOT NULL,
	`idea_type` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`title` text NOT NULL,
	`hook` text,
	`caption` text NOT NULL,
	`hashtags` text,
	`language_code` text NOT NULL,
	`link_url` text,
	`tracked_url` text,
	`story_link_url` text,
	`scheduled_at` text,
	`published_at` text,
	`external_id` text,
	`permalink` text,
	`error_message` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`target_keyword` text,
	`source_type` text,
	`source_title` text,
	`source_url` text,
	`context_notes` text,
	`image_brief` text,
	`created_by` text NOT NULL,
	`approved_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `social_posts_project_scheduled_idx` ON `social_posts` (`project_id`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `social_posts_status_scheduled_idx` ON `social_posts` (`status`,`scheduled_at`);