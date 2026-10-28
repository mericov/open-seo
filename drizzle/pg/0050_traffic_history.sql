CREATE TABLE "traffic_country_shares" (
	"organization_id" text NOT NULL,
	"domain" text NOT NULL,
	"location_code" integer NOT NULL,
	"language_code" text NOT NULL,
	"organic_traffic" real,
	"organic_keywords" integer,
	"paid_traffic" real,
	"paid_keywords" integer,
	CONSTRAINT "traffic_country_shares_organization_id_domain_location_code_language_code_pk" PRIMARY KEY("organization_id","domain","location_code","language_code")
);
--> statement-breakpoint
CREATE TABLE "traffic_domain_snapshots" (
	"organization_id" text NOT NULL,
	"domain" text NOT NULL,
	"countries_fetched_at" text,
	"backlinks" integer,
	"referring_domains" integer,
	"domain_rank" integer,
	"backlinks_fetched_at" text,
	CONSTRAINT "traffic_domain_snapshots_organization_id_domain_pk" PRIMARY KEY("organization_id","domain")
);
--> statement-breakpoint
CREATE TABLE "traffic_history_fetches" (
	"organization_id" text NOT NULL,
	"domain" text NOT NULL,
	"location_code" integer NOT NULL,
	"language_code" text NOT NULL,
	"covered_from" text NOT NULL,
	"last_fetched_at" text NOT NULL,
	CONSTRAINT "traffic_history_fetches_organization_id_domain_location_code_language_code_pk" PRIMARY KEY("organization_id","domain","location_code","language_code")
);
--> statement-breakpoint
CREATE TABLE "traffic_history_months" (
	"organization_id" text NOT NULL,
	"domain" text NOT NULL,
	"location_code" integer NOT NULL,
	"language_code" text NOT NULL,
	"month" text NOT NULL,
	"organic_traffic" real,
	"organic_keywords" integer,
	"organic_traffic_cost" real,
	"paid_traffic" real,
	"paid_keywords" integer,
	"paid_traffic_cost" real,
	CONSTRAINT "traffic_history_months_organization_id_domain_location_code_language_code_month_pk" PRIMARY KEY("organization_id","domain","location_code","language_code","month")
);
--> statement-breakpoint
CREATE TABLE "traffic_history_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"domain" text NOT NULL,
	"month" text NOT NULL,
	"body" text NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traffic_history_positions" (
	"organization_id" text NOT NULL,
	"domain" text NOT NULL,
	"location_code" integer NOT NULL,
	"language_code" text NOT NULL,
	"month" text NOT NULL,
	"kind" text NOT NULL,
	"band" text NOT NULL,
	"keywords" integer NOT NULL,
	CONSTRAINT "traffic_history_positions_organization_id_domain_location_code_language_code_month_kind_band_pk" PRIMARY KEY("organization_id","domain","location_code","language_code","month","kind","band")
);
--> statement-breakpoint
ALTER TABLE "traffic_country_shares" ADD CONSTRAINT "traffic_country_shares_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traffic_domain_snapshots" ADD CONSTRAINT "traffic_domain_snapshots_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traffic_history_fetches" ADD CONSTRAINT "traffic_history_fetches_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traffic_history_months" ADD CONSTRAINT "traffic_history_months_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traffic_history_notes" ADD CONSTRAINT "traffic_history_notes_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traffic_history_positions" ADD CONSTRAINT "traffic_history_positions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "traffic_history_notes_org_domain_idx" ON "traffic_history_notes" USING btree ("organization_id","domain");