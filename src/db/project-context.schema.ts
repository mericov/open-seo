import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { projects } from "./app.schema";
import {
  PAGE_ALERT_KINDS,
  TRACKED_PAGE_KINDS,
  TRACKED_PAGE_SOURCES,
} from "@/shared/pageTracking";

// ============================================================================
// Project memory: the shared AI context every surface (SAM, MCP, settings UI)
// reads and writes. Prose lives in the sections table; list-shaped knowledge is
// normalized so it stays joinable instead of buried in markdown.
// ============================================================================

// One row per (project, section). `key` is either a typed key
// ("business_overview", "current_goal", "positioning", "writing_preferences")
// or "custom:<slug>" for an agent-created section, in which case `title` holds
// its display name.
export const projectContextSections = sqliteTable(
  "project_context_sections",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    title: text("title"),
    content: text("content").notNull(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedBy: text("updated_by", { enum: ["user", "sam", "mcp"] }).notNull(),
  },
  // The composite PK is project-leading, so it also serves the "load every
  // section for this project" read.
  (table) => [primaryKey({ columns: [table.projectId, table.key] })],
);

export const projectCompetitors = sqliteTable(
  "project_competitors",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // Normalized bare host (lowercase, no protocol/www), so agents adding the
    // same competitor from different surfaces upsert onto one row.
    domain: text("domain").notNull(),
    name: text("name"),
    notes: text("notes"),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedBy: text("updated_by", { enum: ["user", "sam", "mcp"] }).notNull(),
  },
  (table) => [
    uniqueIndex("project_competitors_project_domain_idx").on(
      table.projectId,
      table.domain,
    ),
  ],
);

// A curated shortlist of pages that matter, NOT a page inventory — the
// inventory lives in audit_pages and GSC.
export const projectKeyPages = sqliteTable(
  "project_key_pages",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    role: text("role", { enum: ["hub", "spoke", "money", "other"] }).notNull(),
    topic: text("topic"),
    notes: text("notes"),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedBy: text("updated_by", { enum: ["user", "sam", "mcp"] }).notNull(),
  },
  (table) => [
    uniqueIndex("project_key_pages_project_url_idx").on(
      table.projectId,
      table.url,
    ),
  ],
);

// What research has already been bought and what it concluded, so SAM and
// Claude Code stop re-buying the same paid research. Pruned to 90 days on
// append; the date is server-stamped, never supplied by the caller.
export const projectResearchLog = sqliteTable(
  "project_research_log",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    entryDate: text("entry_date").notNull(),
    summary: text("summary").notNull(),
    createdBy: text("created_by", { enum: ["user", "sam", "mcp"] }).notNull(),
    // entry_date is a day stamp, so recency needs its own column — same-day
    // entries would otherwise tie-break on a random uuid. The default emits
    // ISO (unlike current_timestamp's space format) because listResearchLog
    // orders this column lexicographically against app-written ISO stamps.
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (table) => [
    index("project_research_log_project_date_idx").on(
      table.projectId,
      table.entryDate,
    ),
  ],
);

export const projectBlogPosts = sqliteTable(
  "project_blog_posts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title"),
    targetKeyword: text("target_keyword"),
    publishedAt: text("published_at"),
    kind: text("kind", { enum: TRACKED_PAGE_KINDS }).notNull().default("blog"),
    source: text("source", { enum: TRACKED_PAGE_SOURCES })
      .notNull()
      .default("manual"),
    archivedAt: text("archived_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    uniqueIndex("project_blog_posts_project_url_idx").on(
      table.projectId,
      table.url,
    ),
  ],
);

export const projectPageWeeklyStats = sqliteTable(
  "project_page_weekly_stats",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    pageKey: text("page_key").notNull(),
    weekStart: text("week_start").notNull(),
    clicks: integer("clicks").notNull(),
    impressions: integer("impressions").notNull(),
    position: real("position").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.projectId, table.pageKey, table.weekStart],
    }),
    index("project_page_weekly_stats_project_week_idx").on(
      table.projectId,
      table.weekStart,
    ),
  ],
);

export const projectPageAlerts = sqliteTable(
  "project_page_alerts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => projectBlogPosts.id, { onDelete: "cascade" }),
    weekStart: text("week_start").notNull(),
    kind: text("kind", { enum: PAGE_ALERT_KINDS }).notNull(),
    query: text("query").notNull().default(""),
    previousValue: real("previous_value").notNull(),
    currentValue: real("current_value").notNull(),
    seenAt: text("seen_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    uniqueIndex("project_page_alerts_post_week_kind_idx").on(
      table.postId,
      table.weekStart,
      table.kind,
      table.query,
    ),
    index("project_page_alerts_project_week_idx").on(
      table.projectId,
      table.weekStart,
    ),
  ],
);

export const projectPageAdvice = sqliteTable("project_page_advice", {
  postId: text("post_id")
    .primaryKey()
    .references(() => projectBlogPosts.id, { onDelete: "cascade" }),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  adviceJson: text("advice_json").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const projectBlogDrafts = sqliteTable(
  "project_blog_drafts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    targetKeyword: text("target_keyword").notNull(),
    secondaryKeywords: text("secondary_keywords"),
    languageCode: text("language_code"),
    title: text("title").notNull(),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    slug: text("slug"),
    excerpt: text("excerpt"),
    contentHtml: text("content_html").notNull(),
    faqJson: text("faq_json"),
    imageSuggestionsJson: text("image_suggestions_json"),
    internalLinksJson: text("internal_links_json"),
    researchNotes: text("research_notes"),
    wordCount: integer("word_count").notNull().default(0),
    publishedUrl: text("published_url"),
    updatedBy: text("updated_by", { enum: ["user", "sam", "mcp"] }).notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    index("project_blog_drafts_project_updated_idx").on(
      table.projectId,
      table.updatedAt,
    ),
  ],
);
