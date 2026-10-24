CREATE TABLE "inbound_leads" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"source" text,
	"locale" text,
	"page" text,
	"name" text,
	"email" text,
	"phone" text,
	"website" text,
	"message" text,
	"seconds_on_page" integer,
	"verdict" text DEFAULT 'ok' NOT NULL,
	"reason" text,
	"status" text DEFAULT 'new' NOT NULL,
	"note" text,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inbound_leads" ADD CONSTRAINT "inbound_leads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inbound_leads_project_created_idx" ON "inbound_leads" USING btree ("project_id","created_at");