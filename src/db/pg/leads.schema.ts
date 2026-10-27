import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { projects } from "./app.schema";
import { organization } from "./better-auth-schema";
import {
  LEAD_FINDING_CODES,
  LEAD_NOTE_COLORS,
  LEAD_OUTREACH_STATUSES,
} from "@/shared/leadFindings";
import {
  LEAD_CAMPAIGN_PRESETS,
  LEAD_NEED_FILTERS,
  LEAD_SEARCH_SCOPES,
} from "@/shared/leadScan";

// Timestamps are stored as *text* (same column shape as the SQLite schema); see
// the note in pg/app.schema.ts.
const isoNow = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

// Lead finder tables. See leads.schema.ts (SQLite) for the model notes.

export const leadSearches = pgTable(
  "lead_searches",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    source: text("source", { enum: ["local", "shopify"] })
      .notNull()
      .default("local"),
    category: text("category").notNull(),
    nameQuery: text("name_query"),
    locationLabel: text("location_label").notNull(),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    radiusKm: integer("radius_km").notNull(),
    requestedLimit: integer("requested_limit").notNull(),
    skippedDuplicates: integer("skipped_duplicates").notNull().default(0),
    countryCode: text("country_code"),
    keywordQuery: text("keyword_query"),
    categoryGroup: text("category_group"),
    needFilter: text("need_filter", { enum: LEAD_NEED_FILTERS }),
    technology: text("technology"),
    minRating: real("min_rating"),
    maxRank: integer("max_rank"),
    autoRun: boolean("auto_run").notNull().default(false),
    runSize: integer("run_size").notNull().default(10),
    nextOffset: integer("next_offset").notNull().default(0),
    nextRunAt: text("next_run_at"),
    lastRunAt: text("last_run_at"),
    preset: text("preset", { enum: LEAD_CAMPAIGN_PRESETS }),
    scope: text("scope", { enum: LEAD_SEARCH_SCOPES })
      .notNull()
      .default("place"),
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull().default(isoNow),
    updatedAt: text("updated_at").notNull().default(isoNow),
  },
  (table) => [
    index("lead_searches_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
    index("lead_searches_auto_run_idx").on(table.autoRun, table.nextRunAt),
  ],
);

export const leads = pgTable(
  "leads",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    searchId: text("search_id")
      .notNull()
      .references(() => leadSearches.id, { onDelete: "cascade" }),
    businessKey: text("business_key").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    address: text("address"),
    phone: text("phone"),
    website: text("website"),
    domain: text("domain"),
    rating: real("rating"),
    reviewsCount: integer("reviews_count"),
    isClaimed: boolean("is_claimed"),
    photosCount: integer("photos_count"),
    hoursListed: boolean("hours_listed"),
    mapsUrl: text("maps_url"),
    enrichmentStatus: text("enrichment_status", {
      enum: ["pending", "done", "failed", "no_website"],
    })
      .notNull()
      .default("pending"),
    contactPageUrl: text("contact_page_url"),
    instagramUrl: text("instagram_url"),
    facebookUrl: text("facebook_url"),
    linkedinUrl: text("linkedin_url"),
    whatsappUrl: text("whatsapp_url"),
    countryCode: text("country_code"),
    domainRank: integer("domain_rank"),
    productCount: integer("product_count"),
    lastProductAt: text("last_product_at"),
    currency: text("currency"),
    opportunityScore: integer("opportunity_score"),
    outreachStatus: text("outreach_status", { enum: LEAD_OUTREACH_STATUSES })
      .notNull()
      .default("new"),
    contactedAt: text("contacted_at"),
    firstLine: text("first_line"),
    hiddenAt: text("hidden_at"),
    noteColor: text("note_color", { enum: LEAD_NOTE_COLORS }),
    noteText: text("note_text"),
    noteUpdatedAt: text("note_updated_at"),
    remindAt: text("remind_at"),
    reportToken: text("report_token"),
    reportCreatedAt: text("report_created_at"),
    reportViews: integer("report_views").notNull().default(0),
    reportLastViewedAt: text("report_last_viewed_at"),
    followUpStep: integer("follow_up_step").notNull().default(0),
    followUpSentAt: text("follow_up_sent_at"),
    followUpStoppedAt: text("follow_up_stopped_at"),
    createdAt: text("created_at").notNull().default(isoNow),
    updatedAt: text("updated_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("leads_project_business_key_unique").on(
      table.projectId,
      table.businessKey,
    ),
    index("leads_search_status_idx").on(table.searchId, table.enrichmentStatus),
    index("leads_project_outreach_idx").on(
      table.projectId,
      table.outreachStatus,
    ),
    uniqueIndex("leads_report_token_unique").on(table.reportToken),
  ],
);

export const leadEmails = pgTable(
  "lead_emails",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    checkStatus: text("check_status", {
      enum: ["mx_ok", "no_mx", "invalid"],
    }).notNull(),
    kind: text("kind", {
      enum: ["personal", "role", "free_provider"],
    }).notNull(),
    onOwnDomain: boolean("on_own_domain").notNull().default(false),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: text("created_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("lead_emails_lead_email_unique").on(table.leadId, table.email),
  ],
);

export const leadFindings = pgTable(
  "lead_findings",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    code: text("code", { enum: LEAD_FINDING_CODES }).notNull(),
    detail: text("detail"),
    createdAt: text("created_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("lead_findings_lead_code_unique").on(table.leadId, table.code),
  ],
);

export const leadEmailTemplates = pgTable(
  "lead_email_templates",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    language: text("language", { enum: ["tr", "en"] }).notNull(),
    step: integer("step").notNull().default(1),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull().default(isoNow),
    updatedAt: text("updated_at").notNull().default(isoNow),
  },
  (table) => [index("lead_email_templates_project_idx").on(table.projectId)],
);

export const leadFindingPhrases = pgTable(
  "lead_finding_phrases",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    code: text("code", { enum: LEAD_FINDING_CODES }).notNull(),
    language: text("language", { enum: ["tr", "en"] }).notNull(),
    text: text("text").notNull(),
    createdAt: text("created_at").notNull().default(isoNow),
    updatedAt: text("updated_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("lead_finding_phrases_project_code_language_idx").on(
      table.projectId,
      table.code,
      table.language,
    ),
  ],
);

export const leadSearchLeads = pgTable(
  "lead_search_leads",
  {
    id: text("id").primaryKey(),
    searchId: text("search_id")
      .notNull()
      .references(() => leadSearches.id, { onDelete: "cascade" }),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("lead_search_leads_search_lead_unique").on(
      table.searchId,
      table.leadId,
    ),
    index("lead_search_leads_lead_idx").on(table.leadId),
  ],
);

export const leadSearchAreas = pgTable(
  "lead_search_areas",
  {
    id: text("id").primaryKey(),
    searchId: text("search_id")
      .notNull()
      .references(() => leadSearches.id, { onDelete: "cascade" }),
    areaCode: text("area_code").notNull(),
    nextOffset: integer("next_offset").notNull().default(0),
    exhaustedAt: text("exhausted_at"),
    lastRunAt: text("last_run_at"),
  },
  (table) => [
    uniqueIndex("lead_search_areas_search_area_unique").on(
      table.searchId,
      table.areaCode,
    ),
  ],
);

export const contactRegistry = pgTable(
  "contact_registry",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactKey: text("contact_key").notNull(),
    lastContactedAt: text("last_contacted_at"),
    lastProjectId: text("last_project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    suppressedAt: text("suppressed_at"),
    createdAt: text("created_at").notNull().default(isoNow),
    updatedAt: text("updated_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("contact_registry_org_key_unique").on(
      table.organizationId,
      table.contactKey,
    ),
  ],
);
