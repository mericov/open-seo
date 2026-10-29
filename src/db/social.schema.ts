import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { projects } from "./app.schema";
import {
  SOCIAL_CONTEXT_SOURCES,
  SOCIAL_IDEA_TYPES,
  SOCIAL_MEDIA_SOURCES,
  SOCIAL_PLATFORMS,
  SOCIAL_POST_FORMATS,
  SOCIAL_POST_STATUSES,
} from "@/shared/social";

export const metaConnections = sqliteTable(
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
    lastTestOk: integer("last_test_ok", { mode: "boolean" }),
    lastTestMessage: text("last_test_message"),
    connectedByUserId: text("connected_by_user_id"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [uniqueIndex("meta_connections_project_idx").on(table.projectId)],
);

export const projectBrandKits = sqliteTable("project_brand_kits", {
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
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const socialMediaAssets = sqliteTable(
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
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    index("social_media_assets_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
    uniqueIndex("social_media_assets_r2_key_idx").on(table.r2Key),
  ],
);

export const socialPosts = sqliteTable(
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
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
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

export const socialPostMedia = sqliteTable(
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
