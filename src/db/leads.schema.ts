import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { projects } from "./app.schema";
import {
  LEAD_FINDING_CODES,
  LEAD_OUTREACH_STATUSES,
} from "@/shared/leadFindings";

// ============================================================================
// Lead finder: a search pulls business listings for one category around one
// location; each listing becomes a lead whose website is then read for contact
// details. Emails are their own rows so a lead can carry several, each with its
// own check result.
// ============================================================================

export const leadSearches = sqliteTable(
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
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    index("lead_searches_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);

export const leads = sqliteTable(
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
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
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
  ],
);

export const leadEmails = sqliteTable(
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
    onOwnDomain: integer("on_own_domain", { mode: "boolean" })
      .notNull()
      .default(false),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    uniqueIndex("lead_emails_lead_email_unique").on(table.leadId, table.email),
  ],
);

export const leadFindings = sqliteTable(
  "lead_findings",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    code: text("code", { enum: LEAD_FINDING_CODES }).notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    uniqueIndex("lead_findings_lead_code_unique").on(table.leadId, table.code),
  ],
);
