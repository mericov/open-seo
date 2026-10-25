CREATE TABLE "contact_registry" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"contact_key" text NOT NULL,
	"last_contacted_at" text,
	"last_project_id" text,
	"suppressed_at" text,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_search_areas" (
	"id" text PRIMARY KEY NOT NULL,
	"search_id" text NOT NULL,
	"area_code" text NOT NULL,
	"next_offset" integer DEFAULT 0 NOT NULL,
	"exhausted_at" text,
	"last_run_at" text
);
--> statement-breakpoint
CREATE TABLE "lead_search_leads" (
	"id" text PRIMARY KEY NOT NULL,
	"search_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_searches" ADD COLUMN "preset" text;--> statement-breakpoint
ALTER TABLE "lead_searches" ADD COLUMN "scope" text DEFAULT 'place' NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_searches" ADD COLUMN "archived_at" text;--> statement-breakpoint
ALTER TABLE "contact_registry" ADD CONSTRAINT "contact_registry_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_registry" ADD CONSTRAINT "contact_registry_last_project_id_projects_id_fk" FOREIGN KEY ("last_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_search_areas" ADD CONSTRAINT "lead_search_areas_search_id_lead_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."lead_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_search_leads" ADD CONSTRAINT "lead_search_leads_search_id_lead_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."lead_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_search_leads" ADD CONSTRAINT "lead_search_leads_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contact_registry_org_key_unique" ON "contact_registry" USING btree ("organization_id","contact_key");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_search_areas_search_area_unique" ON "lead_search_areas" USING btree ("search_id","area_code");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_search_leads_search_lead_unique" ON "lead_search_leads" USING btree ("search_id","lead_id");--> statement-breakpoint
CREATE INDEX "lead_search_leads_lead_idx" ON "lead_search_leads" USING btree ("lead_id");--> statement-breakpoint
INSERT INTO lead_search_leads (id, search_id, lead_id, created_at) SELECT 'm-' || id, search_id, id, created_at FROM leads;--> statement-breakpoint
UPDATE lead_searches SET preset = 'local_service' WHERE source = 'local';--> statement-breakpoint
UPDATE lead_searches SET scope = 'country', preset = 'shopify_service' WHERE source = 'shopify' AND technology IS NOT NULL;--> statement-breakpoint
UPDATE lead_searches SET scope = 'list' WHERE source = 'shopify' AND technology IS NULL;--> statement-breakpoint
UPDATE leads SET domain = substr(domain, 5) WHERE domain LIKE 'www.%';--> statement-breakpoint
UPDATE leads SET business_key = 'domain:' || domain WHERE domain IS NOT NULL AND business_key NOT LIKE 'domain:%' AND id = (SELECT min(dup.id) FROM leads dup WHERE dup.project_id = leads.project_id AND dup.domain = leads.domain) AND NOT EXISTS (SELECT 1 FROM leads taken WHERE taken.project_id = leads.project_id AND taken.business_key = 'domain:' || leads.domain);--> statement-breakpoint
INSERT INTO contact_registry (id, organization_id, contact_key, last_contacted_at, last_project_id, created_at, updated_at) SELECT 'm-' || min(leads.id), projects.organization_id, leads.domain, max(coalesce(leads.contacted_at, leads.updated_at)), max(leads.project_id), max(leads.updated_at), max(leads.updated_at) FROM leads INNER JOIN projects ON projects.id = leads.project_id WHERE leads.domain IS NOT NULL AND leads.outreach_status <> 'new' GROUP BY projects.organization_id, leads.domain;
