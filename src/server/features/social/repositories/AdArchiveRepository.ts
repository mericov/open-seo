import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { adCompetitorPages, competitorAds } from "@/db/schema";

export type CompetitorAd = typeof competitorAds.$inferSelect;
type CompetitorAdInput = Omit<
  CompetitorAd,
  "id" | "projectId" | "createdAt" | "updatedAt"
>;

async function listPages(projectId: string) {
  return db
    .select()
    .from(adCompetitorPages)
    .where(eq(adCompetitorPages.projectId, projectId))
    .orderBy(adCompetitorPages.pageName);
}

async function upsertPage(
  projectId: string,
  page: {
    pageId: string;
    pageName: string;
    domain: string | null;
    kind: "competitor" | "similar";
  },
) {
  await db
    .insert(adCompetitorPages)
    .values({
      id: crypto.randomUUID(),
      projectId,
      ...page,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: [adCompetitorPages.projectId, adCompetitorPages.pageId],
      set: {
        pageName: page.pageName,
        kind: page.kind,
        domain: sql`coalesce(excluded.domain, ${adCompetitorPages.domain})`,
      },
    });
}

async function removePages(projectId: string, pageIds: string[]) {
  await db
    .delete(adCompetitorPages)
    .where(
      and(
        eq(adCompetitorPages.projectId, projectId),
        inArray(adCompetitorPages.pageId, pageIds),
      ),
    );
}

async function upsertAd(projectId: string, ad: CompetitorAdInput) {
  const now = new Date().toISOString();
  await db
    .insert(competitorAds)
    .values({
      id: crypto.randomUUID(),
      projectId,
      ...ad,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [competitorAds.projectId, competitorAds.libraryId],
      set: {
        pageName: ad.pageName,
        snapshotUrl: ad.snapshotUrl,
        lastSeenAt: ad.lastSeenAt,
        active: ad.active,
        country: sql`coalesce(excluded.country, ${competitorAds.country})`,
        headline: sql`coalesce(excluded.headline, ${competitorAds.headline})`,
        body: sql`coalesce(excluded.body, ${competitorAds.body})`,
        description: sql`coalesce(excluded.description, ${competitorAds.description})`,
        cta: sql`coalesce(excluded.cta, ${competitorAds.cta})`,
        format: sql`case when excluded.format = 'unknown' then ${competitorAds.format} else excluded.format end`,
        hook: sql`coalesce(excluded.hook, ${competitorAds.hook})`,
        angle: sql`coalesce(excluded.angle, ${competitorAds.angle})`,
        offer: sql`coalesce(excluded.offer, ${competitorAds.offer})`,
        mediaUrl: sql`coalesce(excluded.media_url, ${competitorAds.mediaUrl})`,
        transcript: sql`coalesce(excluded.transcript, ${competitorAds.transcript})`,
        sceneSummary: sql`coalesce(excluded.scene_summary, ${competitorAds.sceneSummary})`,
        startedAt: sql`coalesce(excluded.started_at, ${competitorAds.startedAt})`,
        stoppedAt: ad.active
          ? null
          : sql`coalesce(excluded.stopped_at, ${competitorAds.stoppedAt})`,
        updatedAt: now,
      },
    });
}

async function listAds(projectId: string, limit: number) {
  return db
    .select()
    .from(competitorAds)
    .where(eq(competitorAds.projectId, projectId))
    .orderBy(desc(competitorAds.startedAt))
    .limit(limit);
}

async function removeAd(projectId: string, id: string) {
  await db
    .delete(competitorAds)
    .where(
      and(eq(competitorAds.projectId, projectId), eq(competitorAds.id, id)),
    );
}

export const AdArchiveRepository = {
  listPages,
  upsertPage,
  removePages,
  upsertAd,
  listAds,
  removeAd,
};
