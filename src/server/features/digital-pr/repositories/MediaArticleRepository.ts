import { and, asc, count, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { executeInBatches } from "@/db/runBatch";
import { mediaArticles, mediaContacts, mediaOutlets } from "@/db/schema";
import type { ContactSeed } from "@/server/features/digital-pr/repositories/MediaRepository";

async function insertContacts(outletId: string, contacts: ContactSeed[]) {
  const unique = [
    ...new Map(contacts.map((row) => [row.contactKey, row])).values(),
  ];
  const now = new Date().toISOString();
  await executeInBatches(unique, (tx, row) =>
    tx
      .insert(mediaContacts)
      .values({
        id: crypto.randomUUID(),
        outletId,
        ...row,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing(),
  );
}

async function contactIdByKey(outletId: string, contactKey: string) {
  const [row] = await db
    .select({ id: mediaContacts.id, email: mediaContacts.email })
    .from(mediaContacts)
    .where(
      and(
        eq(mediaContacts.outletId, outletId),
        eq(mediaContacts.contactKey, contactKey),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function fillContactEmail(contactId: string, email: string) {
  await db
    .update(mediaContacts)
    .set({ email, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(mediaContacts.id, contactId),
        isNull(mediaContacts.email),
        isNull(mediaContacts.editedAt),
      ),
    );
}

async function listPendingArticles(limit: number, organizationId?: string) {
  return db
    .select({
      id: mediaArticles.id,
      outletId: mediaArticles.outletId,
      url: mediaArticles.url,
      publishedAt: mediaArticles.publishedAt,
      domain: mediaOutlets.domain,
    })
    .from(mediaArticles)
    .innerJoin(mediaOutlets, eq(mediaOutlets.id, mediaArticles.outletId))
    .where(
      and(
        eq(mediaArticles.authorStatus, "pending"),
        organizationId
          ? eq(mediaOutlets.organizationId, organizationId)
          : undefined,
      ),
    )
    .orderBy(asc(mediaArticles.createdAt))
    .limit(limit);
}

async function saveArticleAuthor(
  articleId: string,
  values: {
    status: "done" | "failed";
    authorName: string | null;
    contactId: string | null;
  },
) {
  await db
    .update(mediaArticles)
    .set({
      authorStatus: values.status,
      authorName: values.authorName,
      contactId: values.contactId,
    })
    .where(eq(mediaArticles.id, articleId));
  if (values.contactId) await refreshContactStats(values.contactId);
}

async function refreshContactStats(contactId: string) {
  const [stats] = await db
    .select({
      total: count(),
      last: sql<string | null>`max(${mediaArticles.publishedAt})`,
    })
    .from(mediaArticles)
    .where(eq(mediaArticles.contactId, contactId));
  await db
    .update(mediaContacts)
    .set({
      articleCount: stats?.total ?? 0,
      lastArticleAt: stats?.last ?? null,
    })
    .where(eq(mediaContacts.id, contactId));
}

export const MediaArticleRepository = {
  insertContacts,
  contactIdByKey,
  fillContactEmail,
  listPendingArticles,
  saveArticleAuthor,
  refreshContactStats,
};
