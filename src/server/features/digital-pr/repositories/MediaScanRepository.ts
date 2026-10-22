import {
  and,
  asc,
  count,
  desc,
  eq,
  isNotNull,
  isNull,
  lt,
  or,
} from "drizzle-orm";
import { db } from "@/db";
import { executeInBatches } from "@/db/runBatch";
import {
  mediaArticles,
  mediaOutlets,
  mediaScanRuns,
  mediaScanSettings,
  mediaTopics,
} from "@/db/schema";
import type { MediaScanTrigger, PrMarket } from "@/shared/digitalPr";

async function listTopics(organizationId: string) {
  return db
    .select()
    .from(mediaTopics)
    .where(eq(mediaTopics.organizationId, organizationId))
    .orderBy(asc(mediaTopics.market), asc(mediaTopics.keyword));
}

async function addTopics(
  organizationId: string,
  rows: { keyword: string; market: PrMarket }[],
) {
  const now = new Date().toISOString();
  await executeInBatches(rows, (tx, row) =>
    tx
      .insert(mediaTopics)
      .values({
        id: crypto.randomUUID(),
        organizationId,
        keyword: row.keyword,
        market: row.market,
        createdAt: now,
      })
      .onConflictDoNothing(),
  );
}

async function deleteTopic(organizationId: string, topicId: string) {
  await db
    .delete(mediaTopics)
    .where(
      and(
        eq(mediaTopics.organizationId, organizationId),
        eq(mediaTopics.id, topicId),
      ),
    );
}

async function getSettings(organizationId: string) {
  const [row] = await db
    .select()
    .from(mediaScanSettings)
    .where(eq(mediaScanSettings.organizationId, organizationId))
    .limit(1);
  return row ?? null;
}

async function ensureSettings(organizationId: string) {
  await db
    .insert(mediaScanSettings)
    .values({ organizationId, updatedAt: new Date().toISOString() })
    .onConflictDoNothing();
}

async function setSchedule(
  organizationId: string,
  values: { autoRun: boolean; nextRunAt: string | null },
) {
  await ensureSettings(organizationId);
  await db
    .update(mediaScanSettings)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(mediaScanSettings.organizationId, organizationId));
}

async function claimRunLock(
  organizationId: string,
  runId: string,
  now: string,
  staleBefore: string,
) {
  await ensureSettings(organizationId);
  const rows = await db
    .update(mediaScanSettings)
    .set({ runningRunId: runId, runStartedAt: now })
    .where(
      and(
        eq(mediaScanSettings.organizationId, organizationId),
        or(
          isNull(mediaScanSettings.runningRunId),
          lt(mediaScanSettings.runStartedAt, staleBefore),
        ),
      ),
    )
    .returning({ organizationId: mediaScanSettings.organizationId });
  return rows.length > 0;
}

async function releaseRunLock(
  organizationId: string,
  runId: string,
  values: { lastRunAt: string },
) {
  await db
    .update(mediaScanSettings)
    .set({
      runningRunId: null,
      runStartedAt: null,
      lastRunAt: values.lastRunAt,
      updatedAt: values.lastRunAt,
    })
    .where(
      and(
        eq(mediaScanSettings.organizationId, organizationId),
        eq(mediaScanSettings.runningRunId, runId),
      ),
    );
}

async function listDueSettings(now: string, limit: number) {
  return db
    .select()
    .from(mediaScanSettings)
    .where(
      and(
        eq(mediaScanSettings.autoRun, true),
        isNotNull(mediaScanSettings.nextRunAt),
        lt(mediaScanSettings.nextRunAt, now),
      ),
    )
    .orderBy(asc(mediaScanSettings.nextRunAt))
    .limit(limit);
}

async function claimDueSchedule(
  organizationId: string,
  observedNextRunAt: string,
  nextRunAt: string,
) {
  const rows = await db
    .update(mediaScanSettings)
    .set({ nextRunAt })
    .where(
      and(
        eq(mediaScanSettings.organizationId, organizationId),
        eq(mediaScanSettings.nextRunAt, observedNextRunAt),
      ),
    )
    .returning({ organizationId: mediaScanSettings.organizationId });
  return rows.length > 0;
}

async function createRun(
  organizationId: string,
  runId: string,
  trigger: MediaScanTrigger,
  startedAt: string,
) {
  await db.insert(mediaScanRuns).values({
    id: runId,
    organizationId,
    trigger,
    status: "running",
    startedAt,
  });
}

async function finishRun(
  runId: string,
  values: {
    status: "done" | "failed";
    topicsScanned: number;
    outletsFound: number;
    outletsAdded: number;
    articlesAdded: number;
    error: string | null;
  },
) {
  await db
    .update(mediaScanRuns)
    .set({ ...values, finishedAt: new Date().toISOString() })
    .where(eq(mediaScanRuns.id, runId));
}

async function listRuns(organizationId: string, limit: number) {
  return db
    .select()
    .from(mediaScanRuns)
    .where(eq(mediaScanRuns.organizationId, organizationId))
    .orderBy(desc(mediaScanRuns.startedAt))
    .limit(limit);
}

async function pendingCounts(organizationId: string) {
  const [[outlets], [articles]] = await Promise.all([
    db
      .select({ total: count() })
      .from(mediaOutlets)
      .where(
        and(
          eq(mediaOutlets.organizationId, organizationId),
          eq(mediaOutlets.enrichStatus, "pending"),
        ),
      ),
    db
      .select({ total: count() })
      .from(mediaArticles)
      .innerJoin(mediaOutlets, eq(mediaOutlets.id, mediaArticles.outletId))
      .where(
        and(
          eq(mediaOutlets.organizationId, organizationId),
          eq(mediaArticles.authorStatus, "pending"),
        ),
      ),
  ]);
  return { outlets: outlets?.total ?? 0, articles: articles?.total ?? 0 };
}

export const MediaScanRepository = {
  listTopics,
  addTopics,
  deleteTopic,
  getSettings,
  ensureSettings,
  setSchedule,
  claimRunLock,
  releaseRunLock,
  listDueSettings,
  claimDueSchedule,
  createRun,
  finishRun,
  listRuns,
  pendingCounts,
};
