CREATE TABLE "lead_findings" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"code" text NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "opportunity_score" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "outreach_status" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "contacted_at" text;--> statement-breakpoint
ALTER TABLE "lead_findings" ADD CONSTRAINT "lead_findings_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lead_findings_lead_code_unique" ON "lead_findings" USING btree ("lead_id","code");--> statement-breakpoint
CREATE INDEX "leads_project_outreach_idx" ON "leads" USING btree ("project_id","outreach_status");