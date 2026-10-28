CREATE TABLE "project_page_advice" (
	"post_id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"advice_json" text NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_page_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"post_id" text NOT NULL,
	"week_start" text NOT NULL,
	"kind" text NOT NULL,
	"query" text DEFAULT '' NOT NULL,
	"previous_value" real NOT NULL,
	"current_value" real NOT NULL,
	"seen_at" text,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_page_weekly_stats" (
	"project_id" text NOT NULL,
	"page_key" text NOT NULL,
	"week_start" text NOT NULL,
	"clicks" integer NOT NULL,
	"impressions" integer NOT NULL,
	"position" real NOT NULL,
	CONSTRAINT "project_page_weekly_stats_project_id_page_key_week_start_pk" PRIMARY KEY("project_id","page_key","week_start")
);
--> statement-breakpoint
ALTER TABLE "project_blog_posts" ADD COLUMN "kind" text DEFAULT 'blog' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_blog_posts" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_blog_posts" ADD COLUMN "archived_at" text;--> statement-breakpoint
ALTER TABLE "project_page_advice" ADD CONSTRAINT "project_page_advice_post_id_project_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."project_blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_page_advice" ADD CONSTRAINT "project_page_advice_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_page_alerts" ADD CONSTRAINT "project_page_alerts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_page_alerts" ADD CONSTRAINT "project_page_alerts_post_id_project_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."project_blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_page_weekly_stats" ADD CONSTRAINT "project_page_weekly_stats_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_page_alerts_post_week_kind_idx" ON "project_page_alerts" USING btree ("post_id","week_start","kind","query");--> statement-breakpoint
CREATE INDEX "project_page_alerts_project_week_idx" ON "project_page_alerts" USING btree ("project_id","week_start");--> statement-breakpoint
CREATE INDEX "project_page_weekly_stats_project_week_idx" ON "project_page_weekly_stats" USING btree ("project_id","week_start");