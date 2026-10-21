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
    createdAt: text("created_at").notNull().default(isoNow),
    updatedAt: text("updated_at").notNull().default(isoNow),
  },
  (table) => [
    index("lead_searches_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
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
    createdAt: text("created_at").notNull().default(isoNow),
    updatedAt: text("updated_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("leads_project_business_key_unique").on(
      table.projectId,
      table.businessKey,
    ),
    index("leads_search_status_idx").on(table.searchId, table.enrichmentStatus),
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
