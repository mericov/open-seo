ALTER TABLE "leads" ADD COLUMN "hidden_at" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "note_color" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "note_text" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "note_updated_at" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "remind_at" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "report_token" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "report_created_at" text;--> statement-breakpoint
CREATE UNIQUE INDEX "leads_report_token_unique" ON "leads" USING btree ("report_token");