import type { BillingCustomerContext } from "@/server/billing/subscription";
import { AppError } from "@/server/lib/errors";
import { LeadRepository } from "@/server/features/leads/repositories/LeadRepository";
import {
  fetchAndSaveLocal,
  fetchStoreRows,
  saveStoreRows,
  type SourcePageResult,
} from "@/server/features/leads/services/leadSources";
import { LeadFinderService } from "@/server/features/leads/services/LeadFinderService";
import {
  LEAD_AUTO_RUN_INTERVAL_DAYS,
  categoriesForSearch,
} from "@/shared/leadScan";

const MAX_CALLS_PER_RUN = 3;
const MAX_PROVIDER_OFFSET = 9_000;
const DUE_SEARCHES_PER_TICK = 2;

type SearchRow = NonNullable<
  Awaited<ReturnType<typeof LeadRepository.getSearch>>
>;

function nextWeeklyRun(from = Date.now()) {
  return new Date(
    from + LEAD_AUTO_RUN_INTERVAL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function fetchPage(
  search: SearchRow,
  billing: BillingCustomerContext,
  page: { limit: number; offset: number },
): Promise<SourcePageResult> {
  const target = { projectId: search.projectId, searchId: search.id };
  if (search.source === "local") {
    return fetchAndSaveLocal(
      billing,
      target,
      {
        categories: categoriesForSearch(search),
        nameQuery: search.nameQuery,
        latitude: search.latitude,
        longitude: search.longitude,
        radiusKm: search.radiusKm,
        minRating: search.minRating,
        needFilter: search.needFilter,
      },
      page,
    );
  }
  return (async () => {
    const { returned, rows } = await fetchStoreRows(
      billing,
      {
        technology: search.technology ?? "Shopify",
        keywords: search.keywordQuery?.split(", ").filter(Boolean) ?? [],
        countryCode: search.countryCode,
        maxRank: search.maxRank,
      },
      page,
    );
    const saved = await saveStoreRows(target, rows);
    return { returned, ...saved };
  })();
}

async function runSearch(search: SearchRow, billing: BillingCustomerContext) {
  if (search.source === "shopify" && !search.technology) {
    throw new AppError(
      "VALIDATION_ERROR",
      "A pasted domain list can't run again.",
    );
  }
  let offset = search.nextOffset;
  let added = 0;
  let found = 0;
  for (let call = 0; call < MAX_CALLS_PER_RUN; call++) {
    const limit = search.runSize - added;
    if (limit <= 0) break;
    const result = await fetchPage(search, billing, { limit, offset });
    added += result.added;
    found += result.found;
    offset += result.returned;
    if (result.returned < limit || offset >= MAX_PROVIDER_OFFSET) {
      offset = 0;
      break;
    }
  }
  const now = new Date().toISOString();
  await LeadRepository.updateSearch(search.projectId, search.id, {
    nextOffset: offset,
    lastRunAt: now,
    skippedDuplicates: search.skippedDuplicates + (found - added),
    ...(search.autoRun ? { nextRunAt: nextWeeklyRun() } : {}),
  });
  return { added };
}

async function runNow(
  projectId: string,
  searchId: string,
  billing: BillingCustomerContext,
) {
  const search = await LeadRepository.getSearch(projectId, searchId);
  if (!search) throw new AppError("NOT_FOUND");
  return runSearch(search, billing);
}

async function setSchedule(
  projectId: string,
  searchId: string,
  input: { autoRun: boolean; runSize: number },
) {
  const search = await LeadRepository.getSearch(projectId, searchId);
  if (!search) throw new AppError("NOT_FOUND");
  if (input.autoRun && search.source === "shopify" && !search.technology) {
    throw new AppError(
      "VALIDATION_ERROR",
      "A pasted domain list can't run again.",
    );
  }
  await LeadRepository.updateSearch(projectId, searchId, {
    autoRun: input.autoRun,
    runSize: input.runSize,
    nextRunAt: input.autoRun ? (search.nextRunAt ?? nextWeeklyRun()) : null,
  });
}

export async function runScheduledLeadScans() {
  const now = new Date().toISOString();
  let ran = 0;
  for (const { search, organizationId } of await LeadRepository.listDueSearches(
    now,
    DUE_SEARCHES_PER_TICK,
  )) {
    if (!search.nextRunAt) continue;
    const claimed = await LeadRepository.claimDueSearch(
      search.id,
      search.nextRunAt,
      nextWeeklyRun(),
    );
    if (!claimed) continue;
    try {
      await runSearch(search, {
        organizationId,
        userId: "system",
        userEmail: "system@openseo.so",
        projectId: search.projectId,
      });
      ran++;
    } catch (error) {
      console.error("[lead-scans] scheduled run failed", {
        searchId: search.id,
        error,
      });
    }
  }
  if (ran > 0) return;
  const pending = await LeadRepository.findAutoRunSearchWithPending();
  if (pending) {
    await LeadFinderService.enrichNextBatch(
      pending.projectId,
      pending.searchId,
    );
  }
}

export const LeadScanService = { runNow, setSchedule };
