CREATE TABLE `shopify_blog_articles` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`draft_id` text NOT NULL,
	`article_id` text NOT NULL,
	`blog_id` text NOT NULL,
	`url` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shopify_blog_articles_draft_idx` ON `shopify_blog_articles` (`project_id`,`draft_id`);--> statement-breakpoint
CREATE INDEX `shopify_blog_articles_article_idx` ON `shopify_blog_articles` (`article_id`);--> statement-breakpoint
CREATE TABLE `shopify_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`shop_domain` text NOT NULL,
	`shop_name` text,
	`primary_domain` text,
	`currency_code` text,
	`auth_mode` text NOT NULL,
	`client_id` text,
	`client_secret` text,
	`access_token` text,
	`access_token_expires_at` text,
	`scopes` text,
	`connected_by_user_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shopify_connections_project_idx` ON `shopify_connections` (`project_id`);