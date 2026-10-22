import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization } from "./better-auth-schema";
import { projects } from "./app.schema";
import {
  MEDIA_CONTACT_ROLES,
  MEDIA_CONTACT_SOURCES,
  MEDIA_ENRICH_STATUSES,
  MEDIA_OUTLET_SOURCES,
  MEDIA_OUTLET_TYPES,
  MEDIA_SCAN_STATUSES,
  MEDIA_SCAN_TRIGGERS,
  PR_LANGUAGES,
  PR_MARKETS,
  PR_TARGET_SOURCES,
  PR_TARGET_STATUSES,
} from "@/shared/digitalPr";

const isoNow = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export const mediaTopics = pgTable(
  "media_topics",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    market: text("market", { enum: PR_MARKETS }).notNull(),
    createdAt: text("created_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("media_topics_org_market_keyword_unique").on(
      table.organizationId,
      table.market,
      table.keyword,
    ),
  ],
);

export const mediaScanSettings = pgTable("media_scan_settings", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  autoRun: boolean("auto_run").notNull().default(false),
  nextRunAt: text("next_run_at"),
  lastRunAt: text("last_run_at"),
  runningRunId: text("running_run_id"),
  runStartedAt: text("run_started_at"),
  updatedAt: text("updated_at").notNull().default(isoNow),
});

export const mediaScanRuns = pgTable(
  "media_scan_runs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    trigger: text("trigger", { enum: MEDIA_SCAN_TRIGGERS }).notNull(),
    status: text("status", { enum: MEDIA_SCAN_STATUSES }).notNull(),
    topicsScanned: integer("topics_scanned").notNull().default(0),
    outletsFound: integer("outlets_found").notNull().default(0),
    outletsAdded: integer("outlets_added").notNull().default(0),
    articlesAdded: integer("articles_added").notNull().default(0),
    error: text("error"),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
  },
  (table) => [
    index("media_scan_runs_org_started_idx").on(
      table.organizationId,
      table.startedAt,
    ),
  ],
);

export const mediaOutlets = pgTable(
  "media_outlets",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    name: text("name"),
    type: text("type", { enum: MEDIA_OUTLET_TYPES }).notNull().default("other"),
    market: text("market", { enum: PR_MARKETS }).notNull(),
    source: text("source", { enum: MEDIA_OUTLET_SOURCES }).notNull(),
    homepageUrl: text("homepage_url"),
    mastheadUrl: text("masthead_url"),
    contactPageUrl: text("contact_page_url"),
    organicTraffic: integer("organic_traffic"),
    domainRank: integer("domain_rank"),
    enrichStatus: text("enrich_status", { enum: MEDIA_ENRICH_STATUSES })
      .notNull()
      .default("pending"),
    enrichClaimedAt: text("enrich_claimed_at"),
    enrichedAt: text("enriched_at"),
    notes: text("notes"),
    editedAt: text("edited_at"),
    hiddenAt: text("hidden_at"),
    lastSeenAt: text("last_seen_at"),
    createdAt: text("created_at").notNull().default(isoNow),
    updatedAt: text("updated_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("media_outlets_org_domain_unique").on(
      table.organizationId,
      table.domain,
    ),
    index("media_outlets_enrich_idx").on(table.enrichStatus, table.createdAt),
  ],
);

export const mediaOutletTopics = pgTable(
  "media_outlet_topics",
  {
    outletId: text("outlet_id")
      .notNull()
      .references(() => mediaOutlets.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => mediaTopics.id, { onDelete: "cascade" }),
    lastSeenAt: text("last_seen_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.outletId, table.topicId] }),
    index("media_outlet_topics_topic_idx").on(table.topicId),
  ],
);

export const mediaContacts = pgTable(
  "media_contacts",
  {
    id: text("id").primaryKey(),
    outletId: text("outlet_id")
      .notNull()
      .references(() => mediaOutlets.id, { onDelete: "cascade" }),
    contactKey: text("contact_key").notNull(),
    name: text("name"),
    email: text("email"),
    jobTitle: text("job_title"),
    role: text("role", { enum: MEDIA_CONTACT_ROLES }).notNull(),
    source: text("source", { enum: MEDIA_CONTACT_SOURCES }).notNull(),
    articleCount: integer("article_count").notNull().default(0),
    lastArticleAt: text("last_article_at"),
    editedAt: text("edited_at"),
    hiddenAt: text("hidden_at"),
    createdAt: text("created_at").notNull().default(isoNow),
    updatedAt: text("updated_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("media_contacts_outlet_key_unique").on(
      table.outletId,
      table.contactKey,
    ),
  ],
);

export const mediaArticles = pgTable(
  "media_articles",
  {
    id: text("id").primaryKey(),
    outletId: text("outlet_id")
      .notNull()
      .references(() => mediaOutlets.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => mediaContacts.id, {
      onDelete: "set null",
    }),
    topicId: text("topic_id").references(() => mediaTopics.id, {
      onDelete: "set null",
    }),
    url: text("url").notNull(),
    title: text("title"),
    publishedAt: text("published_at"),
    authorName: text("author_name"),
    authorStatus: text("author_status", { enum: MEDIA_ENRICH_STATUSES })
      .notNull()
      .default("pending"),
    createdAt: text("created_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("media_articles_outlet_url_unique").on(
      table.outletId,
      table.url,
    ),
    index("media_articles_author_status_idx").on(
      table.authorStatus,
      table.createdAt,
    ),
    index("media_articles_contact_idx").on(table.contactId),
  ],
);

export const prTargets = pgTable(
  "pr_targets",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    outletId: text("outlet_id")
      .notNull()
      .references(() => mediaOutlets.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => mediaContacts.id, {
      onDelete: "cascade",
    }),
    targetKey: text("target_key").notNull(),
    source: text("source", { enum: PR_TARGET_SOURCES }).notNull(),
    status: text("status", { enum: PR_TARGET_STATUSES })
      .notNull()
      .default("new"),
    pitch: text("pitch"),
    noteText: text("note_text"),
    remindAt: text("remind_at"),
    contactedAt: text("contacted_at"),
    hiddenAt: text("hidden_at"),
    createdAt: text("created_at").notNull().default(isoNow),
    updatedAt: text("updated_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("pr_targets_project_key_unique").on(
      table.projectId,
      table.targetKey,
    ),
    index("pr_targets_project_status_idx").on(table.projectId, table.status),
    index("pr_targets_contact_idx").on(table.contactId),
    index("pr_targets_outlet_idx").on(table.outletId),
  ],
);

export const prEmailTemplates = pgTable(
  "pr_email_templates",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    language: text("language", { enum: PR_LANGUAGES }).notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull().default(isoNow),
    updatedAt: text("updated_at").notNull().default(isoNow),
  },
  (table) => [index("pr_email_templates_project_idx").on(table.projectId)],
);

export const prGapRuns = pgTable(
  "pr_gap_runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    ownDomain: text("own_domain").notNull(),
    totalDomains: integer("total_domains").notNull().default(0),
    createdAt: text("created_at").notNull().default(isoNow),
  },
  (table) => [
    index("pr_gap_runs_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);

export const prGapCompetitors = pgTable(
  "pr_gap_competitors",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => prGapRuns.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    position: integer("position").notNull(),
    referringDomains: integer("referring_domains").notNull().default(0),
  },
  (table) => [
    uniqueIndex("pr_gap_competitors_run_domain_unique").on(
      table.runId,
      table.domain,
    ),
  ],
);

export const prGapDomains = pgTable(
  "pr_gap_domains",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => prGapRuns.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    rank: integer("rank"),
    competitorCount: integer("competitor_count").notNull(),
    backlinks: integer("backlinks").notNull().default(0),
    spamScore: real("spam_score"),
    firstSeen: text("first_seen"),
    hiddenAt: text("hidden_at"),
  },
  (table) => [
    uniqueIndex("pr_gap_domains_run_domain_unique").on(
      table.runId,
      table.domain,
    ),
  ],
);

export const prGapDomainHits = pgTable(
  "pr_gap_domain_hits",
  {
    gapDomainId: text("gap_domain_id")
      .notNull()
      .references(() => prGapDomains.id, { onDelete: "cascade" }),
    competitorId: text("competitor_id")
      .notNull()
      .references(() => prGapCompetitors.id, { onDelete: "cascade" }),
    backlinks: integer("backlinks").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.gapDomainId, table.competitorId] })],
);
