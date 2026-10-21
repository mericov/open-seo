ALTER TABLE "lead_findings" ADD COLUMN "detail" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "is_claimed" boolean;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "photos_count" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "hours_listed" boolean;