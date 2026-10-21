ALTER TABLE "lead_searches" ADD COLUMN "category_group" text;--> statement-breakpoint
ALTER TABLE "lead_searches" ADD COLUMN "need_filter" text;--> statement-breakpoint
ALTER TABLE "lead_searches" ADD COLUMN "technology" text;--> statement-breakpoint
ALTER TABLE "lead_searches" ADD COLUMN "min_rating" real;--> statement-breakpoint
ALTER TABLE "lead_searches" ADD COLUMN "max_rank" integer;--> statement-breakpoint
ALTER TABLE "lead_searches" ADD COLUMN "auto_run" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_searches" ADD COLUMN "run_size" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_searches" ADD COLUMN "next_offset" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_searches" ADD COLUMN "next_run_at" text;--> statement-breakpoint
ALTER TABLE "lead_searches" ADD COLUMN "last_run_at" text;--> statement-breakpoint
CREATE INDEX "lead_searches_auto_run_idx" ON "lead_searches" USING btree ("auto_run","next_run_at");--> statement-breakpoint
UPDATE lead_searches SET technology = 'Shopify' WHERE source = 'shopify' AND (keyword_query IS NOT NULL OR country_code IS NOT NULL);
