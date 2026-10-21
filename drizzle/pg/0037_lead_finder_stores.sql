ALTER TABLE "lead_searches" ADD COLUMN "source" text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_searches" ADD COLUMN "country_code" text;--> statement-breakpoint
ALTER TABLE "lead_searches" ADD COLUMN "keyword_query" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "country_code" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "domain_rank" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "product_count" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "last_product_at" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "currency" text;