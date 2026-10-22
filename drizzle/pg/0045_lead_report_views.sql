ALTER TABLE "leads" ADD COLUMN "report_views" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "report_last_viewed_at" text;