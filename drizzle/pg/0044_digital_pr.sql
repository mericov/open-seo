CREATE TABLE "media_articles" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"contact_id" text,
	"topic_id" text,
	"url" text NOT NULL,
	"title" text,
	"published_at" text,
	"author_name" text,
	"author_status" text DEFAULT 'pending' NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"outlet_id" text NOT NULL,
	"contact_key" text NOT NULL,
	"name" text,
	"email" text,
	"job_title" text,
	"role" text NOT NULL,
	"source" text NOT NULL,
	"article_count" integer DEFAULT 0 NOT NULL,
	"last_article_at" text,
	"edited_at" text,
	"hidden_at" text,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_outlet_topics" (
	"outlet_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"last_seen_at" text NOT NULL,
	CONSTRAINT "media_outlet_topics_outlet_id_topic_id_pk" PRIMARY KEY("outlet_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "media_outlets" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"domain" text NOT NULL,
	"name" text,
	"type" text DEFAULT 'other' NOT NULL,
	"market" text NOT NULL,
	"source" text NOT NULL,
	"homepage_url" text,
	"masthead_url" text,
	"contact_page_url" text,
	"organic_traffic" integer,
	"domain_rank" integer,
	"enrich_status" text DEFAULT 'pending' NOT NULL,
	"enrich_claimed_at" text,
	"enriched_at" text,
	"notes" text,
	"edited_at" text,
	"hidden_at" text,
	"last_seen_at" text,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_scan_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"topics_scanned" integer DEFAULT 0 NOT NULL,
	"outlets_found" integer DEFAULT 0 NOT NULL,
	"outlets_added" integer DEFAULT 0 NOT NULL,
	"articles_added" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" text NOT NULL,
	"finished_at" text
);
--> statement-breakpoint
CREATE TABLE "media_scan_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"auto_run" boolean DEFAULT false NOT NULL,
	"next_run_at" text,
	"last_run_at" text,
	"running_run_id" text,
	"run_started_at" text,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"keyword" text NOT NULL,
	"market" text NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pr_email_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"language" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pr_gap_competitors" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"domain" text NOT NULL,
	"position" integer NOT NULL,
	"referring_domains" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pr_gap_domain_hits" (
	"gap_domain_id" text NOT NULL,
	"competitor_id" text NOT NULL,
	"backlinks" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pr_gap_domain_hits_gap_domain_id_competitor_id_pk" PRIMARY KEY("gap_domain_id","competitor_id")
);
--> statement-breakpoint
CREATE TABLE "pr_gap_domains" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"domain" text NOT NULL,
	"rank" integer,
	"competitor_count" integer NOT NULL,
	"backlinks" integer DEFAULT 0 NOT NULL,
	"spam_score" real,
	"first_seen" text,
	"hidden_at" text
);
--> statement-breakpoint
CREATE TABLE "pr_gap_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"own_domain" text NOT NULL,
	"total_domains" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pr_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"outlet_id" text NOT NULL,
	"contact_id" text,
	"target_key" text NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"pitch" text,
	"note_text" text,
	"remind_at" text,
	"contacted_at" text,
	"hidden_at" text,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_articles" ADD CONSTRAINT "media_articles_outlet_id_media_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."media_outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_articles" ADD CONSTRAINT "media_articles_contact_id_media_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."media_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_articles" ADD CONSTRAINT "media_articles_topic_id_media_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."media_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_contacts" ADD CONSTRAINT "media_contacts_outlet_id_media_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."media_outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_outlet_topics" ADD CONSTRAINT "media_outlet_topics_outlet_id_media_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."media_outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_outlet_topics" ADD CONSTRAINT "media_outlet_topics_topic_id_media_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."media_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_outlets" ADD CONSTRAINT "media_outlets_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_scan_runs" ADD CONSTRAINT "media_scan_runs_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_scan_settings" ADD CONSTRAINT "media_scan_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_topics" ADD CONSTRAINT "media_topics_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_email_templates" ADD CONSTRAINT "pr_email_templates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_gap_competitors" ADD CONSTRAINT "pr_gap_competitors_run_id_pr_gap_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pr_gap_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_gap_domain_hits" ADD CONSTRAINT "pr_gap_domain_hits_gap_domain_id_pr_gap_domains_id_fk" FOREIGN KEY ("gap_domain_id") REFERENCES "public"."pr_gap_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_gap_domain_hits" ADD CONSTRAINT "pr_gap_domain_hits_competitor_id_pr_gap_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."pr_gap_competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_gap_domains" ADD CONSTRAINT "pr_gap_domains_run_id_pr_gap_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pr_gap_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_gap_runs" ADD CONSTRAINT "pr_gap_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_targets" ADD CONSTRAINT "pr_targets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_targets" ADD CONSTRAINT "pr_targets_outlet_id_media_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."media_outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_targets" ADD CONSTRAINT "pr_targets_contact_id_media_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."media_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_articles_outlet_url_unique" ON "media_articles" USING btree ("outlet_id","url");--> statement-breakpoint
CREATE INDEX "media_articles_author_status_idx" ON "media_articles" USING btree ("author_status","created_at");--> statement-breakpoint
CREATE INDEX "media_articles_contact_idx" ON "media_articles" USING btree ("contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_contacts_outlet_key_unique" ON "media_contacts" USING btree ("outlet_id","contact_key");--> statement-breakpoint
CREATE INDEX "media_outlet_topics_topic_idx" ON "media_outlet_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_outlets_org_domain_unique" ON "media_outlets" USING btree ("organization_id","domain");--> statement-breakpoint
CREATE INDEX "media_outlets_enrich_idx" ON "media_outlets" USING btree ("enrich_status","created_at");--> statement-breakpoint
CREATE INDEX "media_scan_runs_org_started_idx" ON "media_scan_runs" USING btree ("organization_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "media_topics_org_market_keyword_unique" ON "media_topics" USING btree ("organization_id","market","keyword");--> statement-breakpoint
CREATE INDEX "pr_email_templates_project_idx" ON "pr_email_templates" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pr_gap_competitors_run_domain_unique" ON "pr_gap_competitors" USING btree ("run_id","domain");--> statement-breakpoint
CREATE UNIQUE INDEX "pr_gap_domains_run_domain_unique" ON "pr_gap_domains" USING btree ("run_id","domain");--> statement-breakpoint
CREATE INDEX "pr_gap_runs_project_created_idx" ON "pr_gap_runs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pr_targets_project_key_unique" ON "pr_targets" USING btree ("project_id","target_key");--> statement-breakpoint
CREATE INDEX "pr_targets_project_status_idx" ON "pr_targets" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "pr_targets_contact_idx" ON "pr_targets" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "pr_targets_outlet_idx" ON "pr_targets" USING btree ("outlet_id");