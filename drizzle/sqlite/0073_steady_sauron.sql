CREATE TABLE `project_page_advice` (
	`post_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`advice_json` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `project_blog_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_page_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`post_id` text NOT NULL,
	`week_start` text NOT NULL,
	`kind` text NOT NULL,
	`query` text DEFAULT '' NOT NULL,
	`previous_value` real NOT NULL,
	`current_value` real NOT NULL,
	`seen_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `project_blog_posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_page_alerts_post_week_kind_idx` ON `project_page_alerts` (`post_id`,`week_start`,`kind`,`query`);--> statement-breakpoint
CREATE INDEX `project_page_alerts_project_week_idx` ON `project_page_alerts` (`project_id`,`week_start`);--> statement-breakpoint
CREATE TABLE `project_page_weekly_stats` (
	`project_id` text NOT NULL,
	`page_key` text NOT NULL,
	`week_start` text NOT NULL,
	`clicks` integer NOT NULL,
	`impressions` integer NOT NULL,
	`position` real NOT NULL,
	PRIMARY KEY(`project_id`, `page_key`, `week_start`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_page_weekly_stats_project_week_idx` ON `project_page_weekly_stats` (`project_id`,`week_start`);--> statement-breakpoint
ALTER TABLE `project_blog_posts` ADD `kind` text DEFAULT 'blog' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_blog_posts` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_blog_posts` ADD `archived_at` text;