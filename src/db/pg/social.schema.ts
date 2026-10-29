import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { projects } from "./app.schema";
import {
  AD_DRAFT_KINDS,
  AD_DRAFT_STATUSES,
  AD_FORMATS,
  AD_PAGE_KINDS,
  AD_VARIATION_FIELDS,
  SOCIAL_CONTEXT_SOURCES,
  SOCIAL_IDEA_TYPES,
  SOCIAL_MEDIA_SOURCES,
  SOCIAL_PLATFORMS,
  SOCIAL_POST_FORMATS,
  SOCIAL_POST_STATUSES,
} from "@/shared/social";

const isoNow = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export const metaConnections = pgTable(
  "meta_connections",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    pageId: text("page_id"),
    pageName: text("page_name"),
    instagramAccountId: text("instagram_account_id"),
    instagramUsername: text("instagram_username"),
    adAccountId: text("ad_account_id"),
    adAccountName: text("ad_account_name"),
    accessToken: text("access_token").notNull(),
    timezone: text("timezone").notNull(),
    permissions: text("permissions"),
    lastTestedAt: text("last_tested_at"),
    lastTestOk: boolean("last_test_ok"),
    lastTestMessage: text("last_test_message"),
    connectedByUserId: text("connected_by_user_id"),
    createdAt: text("created_at").notNull().default(isoNow),
    updatedAt: text("updated_at").notNull().default(isoNow),
  },
  (table) => [uniqueIndex("meta_connections_project_idx").on(table.projectId)],
);

export const projectBrandKits = pgTable("project_brand_kits", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  tone: text("tone"),
  targetAudience: text("target_audience"),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  accentColor: text("accent_color"),
  headingFont: text("heading_font"),
  bodyFont: text("body_font"),
  logoUrl: text("logo_url"),
  bannedPhrases: text("banned_phrases"),
  updatedAt: text("updated_at").notNull().default(isoNow),
});

export const socialMediaAssets = pgTable(
  "social_media_assets",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    url: text("url").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    source: text("source", { enum: SOCIAL_MEDIA_SOURCES }).notNull(),
    sourceUrl: text("source_url"),
    label: text("label"),
    createdAt: text("created_at").notNull().default(isoNow),
  },
  (table) => [
    index("social_media_assets_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
    uniqueIndex("social_media_assets_r2_key_idx").on(table.r2Key),
  ],
);

export const socialPosts = pgTable(
  "social_posts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    platform: text("platform", { enum: SOCIAL_PLATFORMS }).notNull(),
    format: text("format", { enum: SOCIAL_POST_FORMATS }).notNull(),
    ideaType: text("idea_type", { enum: SOCIAL_IDEA_TYPES }).notNull(),
    status: text("status", { enum: SOCIAL_POST_STATUSES })
      .notNull()
      .default("draft"),
    title: text("title").notNull(),
    hook: text("hook"),
    caption: text("caption").notNull(),
    hashtags: text("hashtags"),
    languageCode: text("language_code").notNull(),
    linkUrl: text("link_url"),
    trackedUrl: text("tracked_url"),
    storyLinkUrl: text("story_link_url"),
    scheduledAt: text("scheduled_at"),
    publishedAt: text("published_at"),
    externalId: text("external_id"),
    permalink: text("permalink"),
    errorMessage: text("error_message"),
    attempts: integer("attempts").notNull().default(0),
    targetKeyword: text("target_keyword"),
    sourceType: text("source_type", { enum: SOCIAL_CONTEXT_SOURCES }),
    sourceTitle: text("source_title"),
    sourceUrl: text("source_url"),
    contextNotes: text("context_notes"),
    imageBrief: text("image_brief"),
    createdBy: text("created_by", { enum: ["user", "mcp"] }).notNull(),
    approvedAt: text("approved_at"),
    createdAt: text("created_at").notNull().default(isoNow),
    updatedAt: text("updated_at").notNull().default(isoNow),
  },
  (table) => [
    index("social_posts_project_scheduled_idx").on(
      table.projectId,
      table.scheduledAt,
    ),
    index("social_posts_status_scheduled_idx").on(
      table.status,
      table.scheduledAt,
    ),
  ],
);

export const socialPostMedia = pgTable(
  "social_post_media",
  {
    postId: text("post_id")
      .notNull()
      .references(() => socialPosts.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => socialMediaAssets.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.assetId] }),
    index("social_post_media_asset_idx").on(table.assetId),
  ],
);

export const adCompetitorPages = pgTable(
  "ad_competitor_pages",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    pageId: text("page_id").notNull(),
    pageName: text("page_name").notNull(),
    domain: text("domain"),
    kind: text("kind", { enum: AD_PAGE_KINDS }).notNull(),
    createdAt: text("created_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("ad_competitor_pages_project_page_idx").on(
      table.projectId,
      table.pageId,
    ),
  ],
);

export const competitorAds = pgTable(
  "competitor_ads",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    libraryId: text("library_id").notNull(),
    pageId: text("page_id").notNull(),
    pageName: text("page_name").notNull(),
    country: text("country"),
    snapshotUrl: text("snapshot_url").notNull(),
    headline: text("headline"),
    body: text("body"),
    description: text("description"),
    cta: text("cta"),
    format: text("format", { enum: AD_FORMATS }).notNull().default("unknown"),
    hook: text("hook"),
    angle: text("angle"),
    offer: text("offer"),
    mediaUrl: text("media_url"),
    transcript: text("transcript"),
    sceneSummary: text("scene_summary"),
    startedAt: text("started_at"),
    stoppedAt: text("stopped_at"),
    lastSeenAt: text("last_seen_at").notNull(),
    active: boolean("active").notNull(),
    createdAt: text("created_at").notNull().default(isoNow),
    updatedAt: text("updated_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("competitor_ads_project_library_idx").on(
      table.projectId,
      table.libraryId,
    ),
    index("competitor_ads_project_page_idx").on(table.projectId, table.pageId),
  ],
);

export const adDrafts = pgTable(
  "ad_drafts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: AD_DRAFT_KINDS }).notNull(),
    status: text("status", { enum: AD_DRAFT_STATUSES })
      .notNull()
      .default("draft"),
    name: text("name").notNull(),
    angle: text("angle"),
    script: text("script"),
    cta: text("cta").notNull(),
    landingUrl: text("landing_url").notNull(),
    trackedUrl: text("tracked_url").notNull(),
    targetKeyword: text("target_keyword"),
    sourceType: text("source_type", { enum: SOCIAL_CONTEXT_SOURCES }),
    sourceTitle: text("source_title"),
    sourceUrl: text("source_url"),
    inspiration: text("inspiration"),
    contextNotes: text("context_notes"),
    metaCampaignId: text("meta_campaign_id"),
    metaAdSetId: text("meta_ad_set_id"),
    metaCreativeId: text("meta_creative_id"),
    metaAdId: text("meta_ad_id"),
    errorMessage: text("error_message"),
    createdBy: text("created_by", { enum: ["user", "mcp"] }).notNull(),
    approvedAt: text("approved_at"),
    sentAt: text("sent_at"),
    createdAt: text("created_at").notNull().default(isoNow),
    updatedAt: text("updated_at").notNull().default(isoNow),
  },
  (table) => [
    index("ad_drafts_project_updated_idx").on(table.projectId, table.updatedAt),
  ],
);

export const adDraftVariations = pgTable(
  "ad_draft_variations",
  {
    id: text("id").primaryKey(),
    draftId: text("draft_id")
      .notNull()
      .references(() => adDrafts.id, { onDelete: "cascade" }),
    field: text("field", { enum: AD_VARIATION_FIELDS }).notNull(),
    position: integer("position").notNull(),
    value: text("value").notNull(),
  },
  (table) => [
    index("ad_draft_variations_draft_idx").on(table.draftId, table.field),
  ],
);

export const adDraftMedia = pgTable(
  "ad_draft_media",
  {
    draftId: text("draft_id")
      .notNull()
      .references(() => adDrafts.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => socialMediaAssets.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.draftId, table.assetId] }),
    index("ad_draft_media_asset_idx").on(table.assetId),
  ],
);
