import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import { db } from "@/db";
import { executeInBatches, runBatch } from "@/db/runBatch";
import {
  prGapCompetitors,
  prGapDomainHits,
  prGapDomains,
  prGapRuns,
} from "@/db/schema";

export type GapDomainRow = {
  domain: string;
  rank: number | null;
  backlinks: number;
  spamScore: number | null;
  firstSeen: string | null;
  hits: { competitor: string; backlinks: number }[];
};

async function saveRun(input: {
  projectId: string;
  ownDomain: string;
  competitors: { domain: string; referringDomains: number }[];
  domains: GapDomainRow[];
}) {
  const runId = crypto.randomUUID();
  const now = new Date().toISOString();
  const competitorIds = new Map(
    input.competitors.map((row) => [row.domain, crypto.randomUUID()]),
  );
  await runBatch((tx) => [
    tx.insert(prGapRuns).values({
      id: runId,
      projectId: input.projectId,
      ownDomain: input.ownDomain,
      totalDomains: input.domains.length,
      createdAt: now,
    }),
    ...input.competitors.map((row, position) =>
      tx.insert(prGapCompetitors).values({
        id: competitorIds.get(row.domain) ?? crypto.randomUUID(),
        runId,
        domain: row.domain,
        position,
        referringDomains: row.referringDomains,
      }),
    ),
  ]);
  const domainRows = input.domains.map((row) => ({
    ...row,
    id: crypto.randomUUID(),
  }));
  await executeInBatches(domainRows, (tx, row) =>
    tx.insert(prGapDomains).values({
      id: row.id,
      runId,
      domain: row.domain,
      rank: row.rank,
      competitorCount: row.hits.length,
      backlinks: row.backlinks,
      spamScore: row.spamScore,
      firstSeen: row.firstSeen,
    }),
  );
  const hitRows = domainRows.flatMap((row) =>
    row.hits.flatMap((hit) => {
      const competitorId = competitorIds.get(hit.competitor);
      return competitorId
        ? [{ gapDomainId: row.id, competitorId, backlinks: hit.backlinks }]
        : [];
    }),
  );
  await executeInBatches(hitRows, (tx, row) =>
    tx.insert(prGapDomainHits).values(row),
  );
  return runId;
}

async function listRuns(projectId: string, limit: number) {
  return db
    .select()
    .from(prGapRuns)
    .where(eq(prGapRuns.projectId, projectId))
    .orderBy(desc(prGapRuns.createdAt))
    .limit(limit);
}

async function getRun(projectId: string, runId: string) {
  const [run] = await db
    .select()
    .from(prGapRuns)
    .where(and(eq(prGapRuns.projectId, projectId), eq(prGapRuns.id, runId)))
    .limit(1);
  if (!run) return null;
  const competitors = await db
    .select()
    .from(prGapCompetitors)
    .where(eq(prGapCompetitors.runId, runId))
    .orderBy(asc(prGapCompetitors.position));
  return { run, competitors };
}

async function deleteRun(projectId: string, runId: string) {
  await db
    .delete(prGapRuns)
    .where(and(eq(prGapRuns.projectId, projectId), eq(prGapRuns.id, runId)));
}

function domainFilters(
  runId: string,
  filters: { minCompetitors: number; maxSpam: number | null },
) {
  return and(
    eq(prGapDomains.runId, runId),
    isNull(prGapDomains.hiddenAt),
    gte(prGapDomains.competitorCount, filters.minCompetitors),
    filters.maxSpam === null
      ? undefined
      : or(
          isNull(prGapDomains.spamScore),
          lte(prGapDomains.spamScore, filters.maxSpam),
        ),
  );
}

async function listDomains(
  runId: string,
  filters: { minCompetitors: number; maxSpam: number | null },
  page: { limit: number; offset: number },
) {
  const where = domainFilters(runId, filters);
  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(prGapDomains)
      .where(where)
      .orderBy(
        desc(prGapDomains.competitorCount),
        desc(prGapDomains.rank),
        asc(prGapDomains.domain),
      )
      .limit(page.limit)
      .offset(page.offset),
    db.select({ total: count() }).from(prGapDomains).where(where),
  ]);
  const hits =
    rows.length === 0
      ? []
      : await db
          .select({
            gapDomainId: prGapDomainHits.gapDomainId,
            competitorId: prGapDomainHits.competitorId,
            backlinks: prGapDomainHits.backlinks,
          })
          .from(prGapDomainHits)
          .where(
            inArray(
              prGapDomainHits.gapDomainId,
              rows.map((row) => row.id),
            ),
          );
  return { rows, hits, total: totals?.total ?? 0 };
}

async function getDomains(runId: string, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(prGapDomains)
    .where(and(eq(prGapDomains.runId, runId), inArray(prGapDomains.id, ids)));
}

async function setHidden(runId: string, ids: string[], hidden: boolean) {
  if (ids.length === 0) return;
  await db
    .update(prGapDomains)
    .set({ hiddenAt: hidden ? new Date().toISOString() : null })
    .where(and(eq(prGapDomains.runId, runId), inArray(prGapDomains.id, ids)));
}

export const GapRepository = {
  saveRun,
  listRuns,
  getRun,
  deleteRun,
  listDomains,
  getDomains,
  setHidden,
};
