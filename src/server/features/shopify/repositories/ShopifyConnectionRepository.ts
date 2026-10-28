import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { shopifyBlogArticles, shopifyConnections } from "@/db/schema";
import type { ShopifyAuthMode } from "@/shared/shopify";

export type ShopifyConnection = typeof shopifyConnections.$inferSelect;

async function getByProjectId(
  projectId: string,
): Promise<ShopifyConnection | null> {
  const rows = await db
    .select()
    .from(shopifyConnections)
    .where(eq(shopifyConnections.projectId, projectId))
    .limit(1);
  return rows[0] ?? null;
}

async function upsert(input: {
  projectId: string;
  shopDomain: string;
  shopName: string | null;
  primaryDomain: string | null;
  currencyCode: string | null;
  authMode: ShopifyAuthMode;
  clientId: string | null;
  clientSecret: string | null;
  accessToken: string;
  accessTokenExpiresAt: string | null;
  scopes: string | null;
  connectedByUserId: string;
}) {
  const now = new Date().toISOString();
  await db
    .insert(shopifyConnections)
    .values({
      id: crypto.randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: shopifyConnections.projectId,
      set: { ...input, updatedAt: now },
    });
}

async function updateToken(
  projectId: string,
  accessToken: string,
  accessTokenExpiresAt: string | null,
) {
  await db
    .update(shopifyConnections)
    .set({
      accessToken,
      accessTokenExpiresAt,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(shopifyConnections.projectId, projectId));
}

async function deleteByProjectId(projectId: string) {
  await db
    .delete(shopifyConnections)
    .where(eq(shopifyConnections.projectId, projectId));
}

async function getArticleForDraft(projectId: string, draftId: string) {
  const rows = await db
    .select()
    .from(shopifyBlogArticles)
    .where(
      and(
        eq(shopifyBlogArticles.projectId, projectId),
        eq(shopifyBlogArticles.draftId, draftId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function saveArticleForDraft(input: {
  projectId: string;
  draftId: string;
  articleId: string;
  blogId: string;
  url: string;
}) {
  const now = new Date().toISOString();
  await db
    .insert(shopifyBlogArticles)
    .values({
      id: crypto.randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [shopifyBlogArticles.projectId, shopifyBlogArticles.draftId],
      set: {
        articleId: input.articleId,
        blogId: input.blogId,
        url: input.url,
        updatedAt: now,
      },
    });
}

export const ShopifyConnectionRepository = {
  getByProjectId,
  upsert,
  updateToken,
  deleteByProjectId,
  getArticleForDraft,
  saveArticleForDraft,
};
