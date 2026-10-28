import { and, desc, eq, gte, inArray, isNull, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  aiObservations,
  aiRuns,
  aiSources,
  projectBlogPosts,
  projectPageAdvice,
  projectPageAlerts,
  projectPageWeeklyStats,
  gscConnections,
  keywordMetrics,
} from "@/db/schema";
import type { PageAlertKind } from "@/shared/pageTracking";

const STATS_ROWS_PER_INSERT = 15;
const STATEMENTS_PER_BATCH = 40;
const KEYS_PER_SELECT = 90;
const ALERT_ROWS_PER_INSERT = 9;
const OPEN_ALERT_LIMIT = 300;

type WeeklyStatInput = {
  pageKey: string;
  clicks: number;
  impressions: number;
  position: number;
};

export type PageAlertInput = {
  postId: string;
  kind: PageAlertKind;
  query: string;
  previousValue: number;
  currentValue: number;
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function listConnectedProjectIds() {
  const rows = await db
    .select({ projectId: gscConnections.projectId })
    .from(gscConnections);
  return rows.map((row) => row.projectId);
}

async function latestWeek(projectId: string) {
  const [row] = await db
    .select({ week: max(projectPageWeeklyStats.weekStart) })
    .from(projectPageWeeklyStats)
    .where(eq(projectPageWeeklyStats.projectId, projectId));
  return row?.week ?? null;
}

async function saveWeek(
  projectId: string,
  weekStart: string,
  rows: WeeklyStatInput[],
) {
  const statements = chunk(rows, STATS_ROWS_PER_INSERT);
  for (const group of chunk(statements, STATEMENTS_PER_BATCH)) {
    await runBatch((tx) =>
      group.map((rowChunk) =>
        tx
          .insert(projectPageWeeklyStats)
          .values(rowChunk.map((row) => ({ projectId, weekStart, ...row })))
          .onConflictDoUpdate({
            target: [
              projectPageWeeklyStats.projectId,
              projectPageWeeklyStats.pageKey,
              projectPageWeeklyStats.weekStart,
            ],
            set: {
              clicks: sql`excluded.clicks`,
              impressions: sql`excluded.impressions`,
              position: sql`excluded.position`,
            },
          }),
      ),
    );
  }
}

async function listStats(
  projectId: string,
  pageKeys: string[],
  fromWeek: string,
) {
  const results = await Promise.all(
    chunk(pageKeys, KEYS_PER_SELECT).map((keyChunk) =>
      db
        .select()
        .from(projectPageWeeklyStats)
        .where(
          and(
            eq(projectPageWeeklyStats.projectId, projectId),
            inArray(projectPageWeeklyStats.pageKey, keyChunk),
            gte(projectPageWeeklyStats.weekStart, fromWeek),
          ),
        ),
    ),
  );
  return results.flat();
}

async function listWeekPageKeys(projectId: string, weekStart: string) {
  const rows = await db
    .select({
      pageKey: projectPageWeeklyStats.pageKey,
      impressions: projectPageWeeklyStats.impressions,
    })
    .from(projectPageWeeklyStats)
    .where(
      and(
        eq(projectPageWeeklyStats.projectId, projectId),
        eq(projectPageWeeklyStats.weekStart, weekStart),
      ),
    )
    .orderBy(desc(projectPageWeeklyStats.impressions))
    .limit(2000);
  return rows.map((row) => row.pageKey);
}

async function addAlerts(
  projectId: string,
  weekStart: string,
  alerts: PageAlertInput[],
) {
  if (alerts.length === 0) return;
  const createdAt = new Date().toISOString();
  await runBatch((tx) =>
    chunk(alerts, ALERT_ROWS_PER_INSERT).map((alertChunk) =>
      tx
        .insert(projectPageAlerts)
        .values(
          alertChunk.map((alert) => ({
            id: crypto.randomUUID(),
            projectId,
            weekStart,
            createdAt,
            ...alert,
          })),
        )
        .onConflictDoNothing(),
    ),
  );
}

async function listRecentAlertKeys(projectId: string, sinceWeek: string) {
  const rows = await db
    .select({
      postId: projectPageAlerts.postId,
      kind: projectPageAlerts.kind,
      query: projectPageAlerts.query,
    })
    .from(projectPageAlerts)
    .where(
      and(
        eq(projectPageAlerts.projectId, projectId),
        gte(projectPageAlerts.weekStart, sinceWeek),
      ),
    );
  return new Set(rows.map((row) => `${row.postId}\n${row.kind}\n${row.query}`));
}

async function listOpenAlerts(projectId: string) {
  return db
    .select({
      id: projectPageAlerts.id,
      postId: projectPageAlerts.postId,
      weekStart: projectPageAlerts.weekStart,
      kind: projectPageAlerts.kind,
      query: projectPageAlerts.query,
      previousValue: projectPageAlerts.previousValue,
      currentValue: projectPageAlerts.currentValue,
    })
    .from(projectPageAlerts)
    .innerJoin(
      projectBlogPosts,
      eq(projectBlogPosts.id, projectPageAlerts.postId),
    )
    .where(
      and(
        eq(projectPageAlerts.projectId, projectId),
        isNull(projectPageAlerts.seenAt),
        isNull(projectBlogPosts.archivedAt),
      ),
    )
    .orderBy(desc(projectPageAlerts.weekStart))
    .limit(OPEN_ALERT_LIMIT);
}

async function markAlertsSeen(projectId: string, ids: string[]) {
  if (ids.length === 0) return;
  const seenAt = new Date().toISOString();
  await runBatch((tx) =>
    chunk(ids, KEYS_PER_SELECT).map((idChunk) =>
      tx
        .update(projectPageAlerts)
        .set({ seenAt })
        .where(
          and(
            eq(projectPageAlerts.projectId, projectId),
            inArray(projectPageAlerts.id, idChunk),
          ),
        ),
    ),
  );
}

async function getAdvice(projectId: string, postId: string) {
  const [row] = await db
    .select()
    .from(projectPageAdvice)
    .where(
      and(
        eq(projectPageAdvice.projectId, projectId),
        eq(projectPageAdvice.postId, postId),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function saveAdvice(
  projectId: string,
  postId: string,
  adviceJson: string,
) {
  const createdAt = new Date().toISOString();
  await db
    .insert(projectPageAdvice)
    .values({ projectId, postId, adviceJson, createdAt })
    .onConflictDoUpdate({
      target: projectPageAdvice.postId,
      set: { adviceJson, createdAt },
    });
  return createdAt;
}

async function listAiCitations(projectId: string, domains: string[]) {
  if (domains.length === 0) return [];
  return db
    .select({
      url: aiSources.url,
      engine: aiObservations.engine,
      collectedAt: aiObservations.collectedAt,
    })
    .from(aiSources)
    .innerJoin(aiObservations, eq(aiObservations.id, aiSources.observationId))
    .innerJoin(aiRuns, eq(aiRuns.id, aiObservations.runId))
    .where(
      and(eq(aiRuns.projectId, projectId), inArray(aiSources.domain, domains)),
    )
    .orderBy(desc(aiObservations.collectedAt))
    .limit(5000);
}

async function listKeywordVolumes(params: {
  projectId: string;
  keywords: string[];
  locationCode: number;
  languageCode: string;
  since: string;
}) {
  if (params.keywords.length === 0) return [];
  const results = await Promise.all(
    chunk(params.keywords, KEYS_PER_SELECT).map((keywordChunk) =>
      db
        .select({
          keyword: keywordMetrics.keyword,
          searchVolume: keywordMetrics.searchVolume,
        })
        .from(keywordMetrics)
        .where(
          and(
            eq(keywordMetrics.projectId, params.projectId),
            eq(keywordMetrics.locationCode, params.locationCode),
            eq(keywordMetrics.languageCode, params.languageCode),
            inArray(keywordMetrics.keyword, keywordChunk),
            gte(keywordMetrics.fetchedAt, params.since),
          ),
        ),
    ),
  );
  return results.flat();
}

export const PageTrackingRepository = {
  listConnectedProjectIds,
  latestWeek,
  saveWeek,
  listStats,
  listWeekPageKeys,
  addAlerts,
  listRecentAlertKeys,
  listOpenAlerts,
  markAlertsSeen,
  getAdvice,
  saveAdvice,
  listAiCitations,
  listKeywordVolumes,
};
