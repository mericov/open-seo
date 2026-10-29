import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { socialMediaAssets, socialPostMedia, socialPosts } from "@/db/schema";
import type { SocialPostStatus } from "@/shared/social";

export type SocialPost = typeof socialPosts.$inferSelect;
type SocialPostInsert = typeof socialPosts.$inferInsert;

async function get(projectId: string, id: string) {
  const rows = await db
    .select()
    .from(socialPosts)
    .where(and(eq(socialPosts.projectId, projectId), eq(socialPosts.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

async function listRange(projectId: string, from: string, to: string) {
  return db
    .select()
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.projectId, projectId),
        gte(socialPosts.scheduledAt, from),
        lte(socialPosts.scheduledAt, to),
      ),
    )
    .orderBy(asc(socialPosts.scheduledAt));
}

async function listUnscheduled(projectId: string) {
  return db
    .select()
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.projectId, projectId),
        sql`${socialPosts.scheduledAt} is null`,
      ),
    )
    .orderBy(desc(socialPosts.createdAt))
    .limit(200);
}

async function listRecent(
  projectId: string,
  limit: number,
  statuses?: SocialPostStatus[],
) {
  return db
    .select()
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.projectId, projectId),
        statuses ? inArray(socialPosts.status, statuses) : undefined,
      ),
    )
    .orderBy(desc(socialPosts.updatedAt))
    .limit(limit);
}

async function listMedia(postIds: string[]) {
  if (postIds.length === 0) return [];
  return db
    .select({
      postId: socialPostMedia.postId,
      position: socialPostMedia.position,
      asset: socialMediaAssets,
    })
    .from(socialPostMedia)
    .innerJoin(
      socialMediaAssets,
      eq(socialMediaAssets.id, socialPostMedia.assetId),
    )
    .where(inArray(socialPostMedia.postId, postIds))
    .orderBy(asc(socialPostMedia.postId), asc(socialPostMedia.position));
}

async function create(values: SocialPostInsert, assetIds: string[]) {
  await runBatch((tx) => [
    tx.insert(socialPosts).values(values),
    ...(assetIds.length > 0
      ? [
          tx.insert(socialPostMedia).values(
            assetIds.map((assetId, position) => ({
              postId: values.id,
              assetId,
              position,
            })),
          ),
        ]
      : []),
  ]);
}

async function update(
  projectId: string,
  id: string,
  values: Partial<SocialPostInsert>,
  assetIds?: string[],
) {
  const now = new Date().toISOString();
  await runBatch((tx) => [
    tx
      .update(socialPosts)
      .set({ ...values, updatedAt: now })
      .where(and(eq(socialPosts.projectId, projectId), eq(socialPosts.id, id))),
    ...(assetIds
      ? [
          tx.delete(socialPostMedia).where(eq(socialPostMedia.postId, id)),
          ...(assetIds.length > 0
            ? [
                tx.insert(socialPostMedia).values(
                  assetIds.map((assetId, position) => ({
                    postId: id,
                    assetId,
                    position,
                  })),
                ),
              ]
            : []),
        ]
      : []),
  ]);
}

async function setStatus(
  projectId: string,
  ids: string[],
  values: Partial<SocialPostInsert>,
  fromStatuses: SocialPostStatus[],
) {
  if (ids.length === 0) return 0;
  const rows = await db
    .update(socialPosts)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(socialPosts.projectId, projectId),
        inArray(socialPosts.id, ids),
        inArray(socialPosts.status, fromStatuses),
      ),
    )
    .returning({ id: socialPosts.id });
  return rows.length;
}

async function remove(projectId: string, id: string) {
  await db
    .delete(socialPosts)
    .where(and(eq(socialPosts.projectId, projectId), eq(socialPosts.id, id)));
}

async function listDue(nowIso: string, limit: number) {
  return db
    .select()
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.status, "scheduled"),
        lte(socialPosts.scheduledAt, nowIso),
      ),
    )
    .orderBy(asc(socialPosts.scheduledAt))
    .limit(limit);
}

async function claim(id: string) {
  const rows = await db
    .update(socialPosts)
    .set({
      status: "publishing",
      attempts: sql`${socialPosts.attempts} + 1`,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(socialPosts.id, id), eq(socialPosts.status, "scheduled")))
    .returning({ id: socialPosts.id });
  return rows.length > 0;
}

async function finish(id: string, values: Partial<SocialPostInsert>) {
  await db
    .update(socialPosts)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(socialPosts.id, id));
}

async function listStuckPublishing(beforeIso: string) {
  return db
    .select({ id: socialPosts.id })
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.status, "publishing"),
        lte(socialPosts.updatedAt, beforeIso),
      ),
    );
}

export const SocialPostRepository = {
  get,
  listRange,
  listUnscheduled,
  listRecent,
  listMedia,
  create,
  update,
  setStatus,
  remove,
  listDue,
  claim,
  finish,
  listStuckPublishing,
};
