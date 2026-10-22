import type { BillingCustomerContext } from "@/server/billing/subscription";
import { createDataforseoClient } from "@/server/lib/dataforseo";
import { AppError } from "@/server/lib/errors";
import { normalizeDomain } from "@/server/features/leads/services/leadSources";
import { ProjectContextRepository } from "@/server/features/project-context/repositories/ProjectContextRepository";
import {
  GapRepository,
  type GapDomainRow,
} from "@/server/features/digital-pr/repositories/GapRepository";
import { MediaRepository } from "@/server/features/digital-pr/repositories/MediaRepository";
import { PrTargetRepository } from "@/server/features/digital-pr/repositories/PrTargetRepository";
import { PR_GAP_MAX_COMPETITORS, type PrMarket } from "@/shared/digitalPr";

const DOMAINS_PER_COMPETITOR = 500;

type ProjectInfo = {
  id: string;
  domain: string | null;
  locationCode: number;
};

function marketForProject(project: ProjectInfo): PrMarket {
  return project.locationCode === 2792 ? "tr" : "us";
}

async function suggestCompetitors(projectId: string) {
  const rows = await ProjectContextRepository.listCompetitors(projectId);
  return rows.map((row) => row.domain);
}

async function run(
  project: ProjectInfo,
  rawCompetitors: string[],
  billing: BillingCustomerContext,
) {
  const ownDomain = project.domain ? normalizeDomain(project.domain) : null;
  if (!ownDomain) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Set the project's domain before running a competitor gap.",
    );
  }
  const competitors = [
    ...new Set(
      rawCompetitors.flatMap((value) => {
        const domain = normalizeDomain(value);
        return domain && domain !== ownDomain ? [domain] : [];
      }),
    ),
  ].slice(0, PR_GAP_MAX_COMPETITORS);
  if (competitors.length === 0) {
    throw new AppError("VALIDATION_ERROR", "Add at least one competitor.");
  }

  const client = createDataforseoClient(billing);
  const results = await Promise.all(
    competitors.map((competitor) =>
      client.backlinks.domainIntersection({
        targets: [competitor],
        excludeTargets: [ownDomain],
        limit: DOMAINS_PER_COMPETITOR,
        creditFeature: "backlinks",
      }),
    ),
  );

  const excluded = new Set([ownDomain, ...competitors]);
  const byDomain = new Map<string, GapDomainRow>();
  const counts = competitors.map(() => 0);
  results.forEach((result, index) => {
    const competitor = competitors[index];
    for (const item of result.items) {
      const metrics = item.domain_intersection?.["1"];
      const domain = metrics?.target ? normalizeDomain(metrics.target) : null;
      if (!metrics || !domain || excluded.has(domain)) continue;
      counts[index]++;
      const backlinks = metrics.backlinks ?? 0;
      const current = byDomain.get(domain) ?? {
        domain,
        rank: null,
        backlinks: 0,
        spamScore: null,
        firstSeen: null,
        hits: [],
      };
      current.rank = Math.max(current.rank ?? 0, metrics.rank ?? 0) || null;
      current.backlinks += backlinks;
      const spam = metrics.backlinks_spam_score;
      if (spam !== null && spam !== undefined) {
        current.spamScore =
          current.spamScore === null ? spam : Math.min(current.spamScore, spam);
      }
      const firstSeen = metrics.first_seen ?? null;
      if (firstSeen && (!current.firstSeen || firstSeen < current.firstSeen)) {
        current.firstSeen = firstSeen;
      }
      current.hits.push({ competitor, backlinks });
      byDomain.set(domain, current);
    }
  });

  const runId = await GapRepository.saveRun({
    projectId: project.id,
    ownDomain,
    competitors: competitors.map((domain, index) => ({
      domain,
      referringDomains: counts[index],
    })),
    domains: [...byDomain.values()],
  });
  return { runId, total: byDomain.size };
}

async function listRuns(projectId: string) {
  return GapRepository.listRuns(projectId, 20);
}

async function getRun(
  projectId: string,
  organizationId: string,
  runId: string,
  filters: { minCompetitors: number; maxSpam: number | null },
  page: { page: number; pageSize: number },
) {
  const found = await GapRepository.getRun(projectId, runId);
  if (!found) throw new AppError("NOT_FOUND");
  const { rows, hits, total } = await GapRepository.listDomains(
    runId,
    filters,
    { limit: page.pageSize, offset: (page.page - 1) * page.pageSize },
  );
  const outletIds = await MediaRepository.outletIdsByDomain(
    organizationId,
    rows.map((row) => row.domain),
  );
  const targeted = await PrTargetRepository.targetedOutletIds(projectId, [
    ...outletIds.values(),
  ]);
  const competitorById = new Map(
    found.competitors.map((row) => [row.id, row.domain]),
  );
  return {
    run: found.run,
    competitors: found.competitors,
    total,
    page: page.page,
    pageSize: page.pageSize,
    domains: rows.map((row) => {
      const outletId = outletIds.get(row.domain) ?? null;
      return {
        id: row.id,
        domain: row.domain,
        rank: row.rank,
        competitorCount: row.competitorCount,
        backlinks: row.backlinks,
        spamScore: row.spamScore,
        firstSeen: row.firstSeen,
        inPool: outletId !== null,
        inList: outletId !== null && targeted.has(outletId),
        competitors: hits
          .filter((hit) => hit.gapDomainId === row.id)
          .flatMap((hit) => {
            const domain = competitorById.get(hit.competitorId);
            return domain ? [{ domain, backlinks: hit.backlinks }] : [];
          }),
      };
    }),
  };
}

async function addToList(
  project: ProjectInfo,
  organizationId: string,
  runId: string,
  gapDomainIds: string[],
) {
  const found = await GapRepository.getRun(project.id, runId);
  if (!found) throw new AppError("NOT_FOUND");
  const rows = await GapRepository.getDomains(runId, gapDomainIds);
  const now = new Date().toISOString();
  const { ids } = await MediaRepository.upsertOutlets(
    organizationId,
    rows.map((row) => ({
      domain: row.domain,
      name: null,
      type: "other",
      market: marketForProject(project),
      source: "gap",
      homepageUrl: `https://${row.domain}/`,
      domainRank: row.rank,
    })),
    now,
  );
  return PrTargetRepository.addTargets(
    project.id,
    [...ids.values()].map((outletId) => ({
      outletId,
      contactId: null,
      source: "gap" as const,
    })),
  );
}

async function setHidden(
  projectId: string,
  runId: string,
  gapDomainIds: string[],
  hidden: boolean,
) {
  const found = await GapRepository.getRun(projectId, runId);
  if (!found) throw new AppError("NOT_FOUND");
  await GapRepository.setHidden(runId, gapDomainIds, hidden);
}

async function deleteRun(projectId: string, runId: string) {
  await GapRepository.deleteRun(projectId, runId);
}

export const CompetitorGapService = {
  suggestCompetitors,
  run,
  listRuns,
  getRun,
  addToList,
  setHidden,
  deleteRun,
};
