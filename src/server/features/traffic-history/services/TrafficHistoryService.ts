import { sortBy } from "remeda";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { createDataforseoClient } from "@/server/lib/dataforseo";
import { createTrafficHistoryClient } from "@/server/features/traffic-history/services/trafficHistoryClient";
import type { HistoricalRankItem } from "@/server/lib/dataforseo/traffic-history";
import { parseResearchTargetOrThrow } from "@/server/lib/domainUtils";
import { AppError } from "@/server/lib/errors";
import { assertLabsLocationCode } from "@/server/lib/market";
import { resolveLabsMarket } from "@/shared/keyword-locations";
import {
  TrafficHistoryRepository,
  type TrafficCountryInsert,
  type TrafficMarket,
  type TrafficMonthInsert,
  type TrafficPositionInsert,
} from "@/server/features/traffic-history/repositories/TrafficHistoryRepository";
import {
  TRAFFIC_HISTORY_DEFAULT_MONTHS,
  TRAFFIC_KINDS,
  TRAFFIC_POSITION_BANDS,
  addMonths,
  canRefreshTrafficHistory,
  currentMonth,
  extendTargetMonth,
  monthsBetween,
  type TrafficExtendRange,
  type TrafficPositionBand,
} from "@/shared/trafficHistory";

const COUNTRY_ROW_LIMIT = 1000;

type PositionCounts = Partial<Record<TrafficPositionBand, number>>;

function resolveMarket(input: {
  organizationId: string;
  project: { locationCode: number; languageCode: string };
  domain: string;
  locationCode?: number;
}): TrafficMarket {
  const market = resolveLabsMarket(
    { locationCode: input.locationCode },
    input.project,
  );
  assertLabsLocationCode(market.locationCode);
  return {
    organizationId: input.organizationId,
    domain: parseResearchTargetOrThrow(input.domain).hostname,
    ...market,
  };
}

function roundOrNull(value: number | null | undefined) {
  return value == null ? null : Math.round(value);
}

function itemMonth(item: HistoricalRankItem) {
  return `${item.year}-${String(item.month).padStart(2, "0")}`;
}

function lastDayOfMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthIndex, 0)).toISOString().slice(0, 10);
}

function mapHistory(market: TrafficMarket, items: HistoricalRankItem[]) {
  const months: TrafficMonthInsert[] = [];
  const positions: TrafficPositionInsert[] = [];
  for (const item of items) {
    const month = itemMonth(item);
    const organic = item.metrics?.organic;
    const paid = item.metrics?.paid;
    months.push({
      ...market,
      month,
      organicTraffic: organic?.etv ?? null,
      organicKeywords: roundOrNull(organic?.count),
      organicTrafficCost: organic?.estimated_paid_traffic_cost ?? null,
      paidTraffic: paid?.etv ?? null,
      paidKeywords: roundOrNull(paid?.count),
      paidTrafficCost: paid?.estimated_paid_traffic_cost ?? null,
    });
    for (const kind of TRAFFIC_KINDS) {
      const metrics = item.metrics?.[kind];
      for (const band of TRAFFIC_POSITION_BANDS) {
        const keywords = metrics?.[band];
        if (keywords == null) continue;
        positions.push({
          ...market,
          month,
          kind,
          band,
          keywords: Math.round(keywords),
        });
      }
    }
  }
  return { months, positions };
}

async function fetchAndSaveHistory(
  market: TrafficMarket,
  billing: BillingCustomerContext,
  request: { dateFrom?: string; dateTo?: string; expectedMonths: number },
  coveredFrom: (fetchedMonths: string[]) => string,
) {
  const items = await createTrafficHistoryClient(
    billing,
  ).historicalRankOverview({
    target: market.domain,
    locationCode: market.locationCode,
    languageCode: market.languageCode,
    ...request,
  });
  const { months, positions } = mapHistory(market, items);
  await TrafficHistoryRepository.saveMonths(market, months, positions, {
    coveredFrom: coveredFrom(months.map((row) => row.month)),
    lastFetchedAt: new Date().toISOString(),
  });
}

async function fetchAndSaveCountries(
  organizationId: string,
  domain: string,
  billing: BillingCustomerContext,
) {
  const items = await createTrafficHistoryClient(billing).rankByLocation({
    target: domain,
    limit: COUNTRY_ROW_LIMIT,
  });
  const rows: TrafficCountryInsert[] = items.flatMap((item) =>
    item.location_code == null || !item.language_code
      ? []
      : [
          {
            organizationId,
            domain,
            locationCode: item.location_code,
            languageCode: item.language_code,
            organicTraffic: item.metrics?.organic?.etv ?? null,
            organicKeywords: roundOrNull(item.metrics?.organic?.count),
            paidTraffic: item.metrics?.paid?.etv ?? null,
            paidKeywords: roundOrNull(item.metrics?.paid?.count),
          },
        ],
  );
  await TrafficHistoryRepository.saveCountries(
    organizationId,
    domain,
    rows,
    new Date().toISOString(),
  );
}

async function fetchAndSaveBacklinks(
  organizationId: string,
  domain: string,
  billing: BillingCustomerContext,
) {
  try {
    const summary = await createDataforseoClient(billing).backlinks.summary({
      target: domain,
    });
    await TrafficHistoryRepository.saveBacklinks(organizationId, domain, {
      backlinks: summary.backlinks ?? null,
      referringDomains: summary.referring_domains ?? null,
      domainRank: roundOrNull(summary.rank),
      backlinksFetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("traffic-history.backlinks-summary failed:", error);
  }
}

async function ensureDomainSnapshot(
  organizationId: string,
  domain: string,
  billing: BillingCustomerContext,
) {
  const snapshot = await TrafficHistoryRepository.getSnapshot(
    organizationId,
    domain,
  );
  if (snapshot) return;
  await fetchAndSaveCountries(organizationId, domain, billing);
  await fetchAndSaveBacklinks(organizationId, domain, billing);
}

async function getView(market: TrafficMarket) {
  const [fetch, months, positions, snapshot, countries, notes] =
    await Promise.all([
      TrafficHistoryRepository.getFetch(market),
      TrafficHistoryRepository.listMonths(market),
      TrafficHistoryRepository.listPositions(market),
      TrafficHistoryRepository.getSnapshot(
        market.organizationId,
        market.domain,
      ),
      TrafficHistoryRepository.listCountries(
        market.organizationId,
        market.domain,
      ),
      TrafficHistoryRepository.listNotes(market.organizationId, market.domain),
    ]);

  const positionsByMonth = new Map<
    string,
    { organic: PositionCounts; paid: PositionCounts }
  >();
  for (const row of positions) {
    const entry = positionsByMonth.get(row.month) ?? { organic: {}, paid: {} };
    entry[row.kind][row.band] = row.keywords;
    positionsByMonth.set(row.month, entry);
  }

  const countryTotals = new Map<
    number,
    {
      locationCode: number;
      organicTraffic: number;
      organicKeywords: number;
      paidTraffic: number;
      paidKeywords: number;
    }
  >();
  for (const row of countries) {
    const total = countryTotals.get(row.locationCode) ?? {
      locationCode: row.locationCode,
      organicTraffic: 0,
      organicKeywords: 0,
      paidTraffic: 0,
      paidKeywords: 0,
    };
    total.organicTraffic += row.organicTraffic ?? 0;
    total.organicKeywords += row.organicKeywords ?? 0;
    total.paidTraffic += row.paidTraffic ?? 0;
    total.paidKeywords += row.paidKeywords ?? 0;
    countryTotals.set(row.locationCode, total);
  }

  return {
    domain: market.domain,
    locationCode: market.locationCode,
    languageCode: market.languageCode,
    fetch: fetch
      ? { coveredFrom: fetch.coveredFrom, lastFetchedAt: fetch.lastFetchedAt }
      : null,
    months: months.map((row) => ({
      month: row.month,
      organicTraffic: row.organicTraffic,
      organicKeywords: row.organicKeywords,
      organicTrafficCost: row.organicTrafficCost,
      paidTraffic: row.paidTraffic,
      paidKeywords: row.paidKeywords,
      paidTrafficCost: row.paidTrafficCost,
      organicPositions: positionsByMonth.get(row.month)?.organic ?? {},
      paidPositions: positionsByMonth.get(row.month)?.paid ?? {},
    })),
    countries: sortBy(
      [...countryTotals.values()],
      [(country) => country.organicTraffic, "desc"],
    ),
    countriesFetchedAt: snapshot?.countriesFetchedAt ?? null,
    backlinks: snapshot?.backlinksFetchedAt
      ? {
          backlinks: snapshot.backlinks,
          referringDomains: snapshot.referringDomains,
          domainRank: snapshot.domainRank,
          fetchedAt: snapshot.backlinksFetchedAt,
        }
      : null,
    notes,
  };
}

async function ensure(market: TrafficMarket, billing: BillingCustomerContext) {
  const existing = await TrafficHistoryRepository.getFetch(market);
  if (!existing) {
    const windowStart = addMonths(
      currentMonth(),
      -(TRAFFIC_HISTORY_DEFAULT_MONTHS - 1),
    );
    await fetchAndSaveHistory(
      market,
      billing,
      { expectedMonths: TRAFFIC_HISTORY_DEFAULT_MONTHS },
      (fetched) =>
        fetched.reduce(
          (min, month) => (month < min ? month : min),
          windowStart,
        ),
    );
  }
  await ensureDomainSnapshot(market.organizationId, market.domain, billing);
  return getView(market);
}

async function extend(
  market: TrafficMarket,
  range: TrafficExtendRange,
  billing: BillingCustomerContext,
) {
  const existing = await TrafficHistoryRepository.getFetch(market);
  if (!existing) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Load the recent traffic history for this country first.",
    );
  }
  const target = extendTargetMonth(range);
  if (existing.coveredFrom <= target) return getView(market);

  await fetchAndSaveHistory(
    market,
    billing,
    {
      dateFrom: `${target}-01`,
      dateTo: lastDayOfMonth(addMonths(existing.coveredFrom, -1)),
      expectedMonths: monthsBetween(target, existing.coveredFrom),
    },
    () => target,
  );
  return getView(market);
}

async function refresh(market: TrafficMarket, billing: BillingCustomerContext) {
  const existing = await TrafficHistoryRepository.getFetch(market);
  if (!existing) return ensure(market, billing);

  const months = await TrafficHistoryRepository.listMonths(market);
  const latest = months.at(-1)?.month ?? null;
  if (!canRefreshTrafficHistory(latest, existing.lastFetchedAt)) {
    return getView(market);
  }

  const now = currentMonth();
  const from = latest
    ? addMonths(latest, 1)
    : addMonths(now, -(TRAFFIC_HISTORY_DEFAULT_MONTHS - 1));
  await fetchAndSaveHistory(
    market,
    billing,
    {
      dateFrom: `${from}-01`,
      expectedMonths: monthsBetween(from, now) + 1,
    },
    () => existing.coveredFrom,
  );

  const snapshot = await TrafficHistoryRepository.getSnapshot(
    market.organizationId,
    market.domain,
  );
  const isStale = (fetchedAt: string | null | undefined) =>
    !fetchedAt || fetchedAt.slice(0, 7) < now;
  if (isStale(snapshot?.countriesFetchedAt)) {
    await fetchAndSaveCountries(market.organizationId, market.domain, billing);
  }
  if (isStale(snapshot?.backlinksFetchedAt)) {
    await fetchAndSaveBacklinks(market.organizationId, market.domain, billing);
  }
  return getView(market);
}

async function addNote(market: TrafficMarket, month: string, body: string) {
  await TrafficHistoryRepository.addNote(
    market.organizationId,
    market.domain,
    month,
    body,
  );
  return getView(market);
}

async function deleteNote(market: TrafficMarket, noteId: string) {
  await TrafficHistoryRepository.deleteNote(market.organizationId, noteId);
  return getView(market);
}

export type TrafficHistoryView = Awaited<ReturnType<typeof getView>>;

export const TrafficHistoryService = {
  resolveMarket,
  getView,
  ensure,
  extend,
  refresh,
  addNote,
  deleteNote,
} as const;
