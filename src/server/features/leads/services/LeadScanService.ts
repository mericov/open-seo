import type { BillingCustomerContext } from "@/server/billing/subscription";
import { AppError } from "@/server/lib/errors";
import { CampaignRepository } from "@/server/features/leads/repositories/CampaignRepository";
import { LeadRepository } from "@/server/features/leads/repositories/LeadRepository";
import {
  fetchAndSaveLocal,
  fetchStoreRows,
  saveStoreRows,
  type SaveTarget,
  type SourcePageResult,
} from "@/server/features/leads/services/leadSources";
import { LeadFinderService } from "@/server/features/leads/services/LeadFinderService";
import { leadAreasFor } from "@/shared/leadAreas";
import {
  LEAD_AUTO_RUN_INTERVAL_DAYS,
  categoriesForSearch,
} from "@/shared/leadScan";

const MAX_CALLS_PER_RUN = 5;
const MAX_PROVIDER_OFFSET = 9_000;
const DUE_SEARCHES_PER_TICK = 2;
// Roughly half the businesses found publish a reachable email, so a fill asks
// for twice what the pool is missing.
const FETCH_PER_MISSING_LEAD = 2;
const MAX_FETCH_PER_RUN = 100;

type SearchRow = NonNullable<
  Awaited<ReturnType<typeof LeadRepository.getSearch>>
>;

function nextWeeklyRun(from = Date.now()) {
  return new Date(
    from + LEAD_AUTO_RUN_INTERVAL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function localParams(
  search: SearchRow,
  circle: { latitude: number; longitude: number; radiusKm: number },
) {
  return {
    categories: categoriesForSearch(search),
    nameQuery: search.nameQuery,
    minRating: search.minRating,
    needFilter: search.needFilter,
    ...circle,
  };
}

async function fetchPage(
  search: SearchRow,
  target: SaveTarget,
  billing: BillingCustomerContext,
  page: { limit: number; offset: number },
): Promise<SourcePageResult> {
  if (search.source === "local") {
    return fetchAndSaveLocal(
      billing,
      target,
      localParams(search, {
        latitude: search.latitude,
        longitude: search.longitude,
        radiusKm: search.radiusKm,
      }),
      page,
    );
  }
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
  return { returned, ...(await saveStoreRows(target, rows)) };
}

// Reads further into one ordered result set (a single place, or the country's
// store index), wrapping to the top when it runs out so later runs pick up
// newly listed businesses.
async function readSingleSource(
  search: SearchRow,
  target: SaveTarget,
  billing: BillingCustomerContext,
  want: number,
) {
  let offset = search.nextOffset;
  let gained = 0;
  let found = 0;
  let added = 0;
  for (let call = 0; call < MAX_CALLS_PER_RUN && gained < want; call++) {
    const limit = want - gained;
    const result = await fetchPage(search, target, billing, { limit, offset });
    gained += result.added + result.linked;
    found += result.found;
    added += result.added;
    offset += result.returned;
    if (result.returned < limit || offset >= MAX_PROVIDER_OFFSET) {
      offset = 0;
      break;
    }
  }
  await LeadRepository.updateSearch(search.projectId, search.id, {
    nextOffset: offset,
  });
  return { found, added };
}

// Walks a country's metro areas in order, continuing each from where the last
// run stopped and moving on once an area has nothing left. When every area is
// read, the walk starts over.
async function readAreas(
  search: SearchRow,
  target: SaveTarget,
  billing: BillingCustomerContext,
  want: number,
) {
  const areas = leadAreasFor(search.countryCode);
  const progress = new Map(
    (await CampaignRepository.listAreas(search.id)).map((row) => [
      row.areaCode,
      row,
    ]),
  );
  let gained = 0;
  let found = 0;
  let added = 0;
  let calls = 0;
  let open = 0;
  for (const area of areas) {
    if (progress.get(area.code)?.exhaustedAt) continue;
    open++;
    if (calls >= MAX_CALLS_PER_RUN || gained >= want) continue;
    const offset = progress.get(area.code)?.nextOffset ?? 0;
    const limit = want - gained;
    const result = await fetchAndSaveLocal(
      billing,
      target,
      localParams(search, area),
      { limit, offset },
    );
    calls++;
    gained += result.added + result.linked;
    found += result.found;
    added += result.added;
    const nextOffset = offset + result.returned;
    const exhausted =
      result.returned < limit || nextOffset >= MAX_PROVIDER_OFFSET;
    if (exhausted) open--;
    await CampaignRepository.saveArea(search.id, area.code, {
      nextOffset: exhausted ? 0 : nextOffset,
      exhaustedAt: exhausted ? new Date().toISOString() : null,
      lastRunAt: new Date().toISOString(),
    });
  }
  if (open === 0) await CampaignRepository.resetAreas(search.id);
  return { found, added };
}

// Tops the campaign's pool of ready leads up to its weekly target. Leads still
// waiting to be read count toward the pool, so a run never fetches for leads it
// has not had the chance to check yet.
async function fillPool(search: SearchRow, billing: BillingCustomerContext) {
  if (search.scope === "list") {
    throw new AppError(
      "VALIDATION_ERROR",
      "A pasted domain list can't run again.",
    );
  }
  const pool = await LeadRepository.poolCounts(search.projectId, search.id);
  const missing = search.runSize - pool.ready - pool.pending;
  const now = new Date().toISOString();
  const schedule = search.autoRun ? { nextRunAt: nextWeeklyRun() } : {};
  if (missing <= 0) {
    await LeadRepository.updateSearch(search.projectId, search.id, {
      lastRunAt: now,
      ...schedule,
    });
    return { added: 0, ...pool, target: search.runSize };
  }
  const want = Math.min(missing * FETCH_PER_MISSING_LEAD, MAX_FETCH_PER_RUN);
  const target = {
    organizationId: billing.organizationId,
    projectId: search.projectId,
    searchId: search.id,
  };
  const { found, added } =
    search.source === "local" && search.scope === "country"
      ? await readAreas(search, target, billing, want)
      : await readSingleSource(search, target, billing, want);
  await LeadRepository.updateSearch(search.projectId, search.id, {
    lastRunAt: now,
    skippedDuplicates: search.skippedDuplicates + (found - added),
    ...schedule,
  });
  return {
    added,
    ready: pool.ready,
    pending: pool.pending + added,
    target: search.runSize,
  };
}

async function runNow(
  projectId: string,
  searchId: string,
  billing: BillingCustomerContext,
) {
  const search = await LeadRepository.getSearch(projectId, searchId);
  if (!search) throw new AppError("NOT_FOUND");
  return fillPool(search, billing);
}

async function setSchedule(
  projectId: string,
  searchId: string,
  input: { autoRun: boolean; runSize: number },
) {
  const search = await LeadRepository.getSearch(projectId, searchId);
  if (!search) throw new AppError("NOT_FOUND");
  if (input.autoRun && search.scope === "list") {
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
      await fillPool(search, {
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

export const LeadScanService = { fillPool, runNow, setSchedule };
