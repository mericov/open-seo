import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { socialMediaAssets } from "@/db/schema";

export type SocialMediaAsset = typeof socialMediaAssets.$inferSelect;

async function insert(asset: Omit<SocialMediaAsset, "createdAt">) {
  await db
    .insert(socialMediaAssets)
    .values({ ...asset, createdAt: new Date().toISOString() });
}

async function list(projectId: string, limit: number) {
  return db
    .select()
    .from(socialMediaAssets)
    .where(eq(socialMediaAssets.projectId, projectId))
    .orderBy(desc(socialMediaAssets.createdAt))
    .limit(limit);
}

async function getMany(projectId: string, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(socialMediaAssets)
    .where(
      and(
        eq(socialMediaAssets.projectId, projectId),
        inArray(socialMediaAssets.id, ids),
      ),
    );
}

async function remove(projectId: string, id: string) {
  const rows = await db
    .delete(socialMediaAssets)
    .where(
      and(
        eq(socialMediaAssets.projectId, projectId),
        eq(socialMediaAssets.id, id),
      ),
    )
    .returning({ r2Key: socialMediaAssets.r2Key });
  return rows[0] ?? null;
}

export const SocialMediaRepository = { insert, list, getMany, remove };
