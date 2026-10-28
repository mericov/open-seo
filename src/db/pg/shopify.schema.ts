import { sql } from "drizzle-orm";
import { index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { projects } from "./app.schema";
import { SHOPIFY_AUTH_MODES } from "@/shared/shopify";

const isoNow = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export const shopifyConnections = pgTable(
  "shopify_connections",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    shopDomain: text("shop_domain").notNull(),
    shopName: text("shop_name"),
    primaryDomain: text("primary_domain"),
    currencyCode: text("currency_code"),
    authMode: text("auth_mode", { enum: SHOPIFY_AUTH_MODES }).notNull(),
    clientId: text("client_id"),
    clientSecret: text("client_secret"),
    accessToken: text("access_token"),
    accessTokenExpiresAt: text("access_token_expires_at"),
    scopes: text("scopes"),
    connectedByUserId: text("connected_by_user_id"),
    createdAt: text("created_at").notNull().default(isoNow),
    updatedAt: text("updated_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("shopify_connections_project_idx").on(table.projectId),
  ],
);

export const shopifyBlogArticles = pgTable(
  "shopify_blog_articles",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    draftId: text("draft_id").notNull(),
    articleId: text("article_id").notNull(),
    blogId: text("blog_id").notNull(),
    url: text("url").notNull(),
    createdAt: text("created_at").notNull().default(isoNow),
    updatedAt: text("updated_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("shopify_blog_articles_draft_idx").on(
      table.projectId,
      table.draftId,
    ),
    index("shopify_blog_articles_article_idx").on(table.articleId),
  ],
);
