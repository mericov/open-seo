import { and, asc, eq } from "drizzle-orm";
import { chunk } from "remeda";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  trafficCountryShares,
  trafficDomainSnapshots,
  trafficHistoryFetches,
  trafficHistoryMonths,
  trafficHistoryNotes,
  trafficHistoryPositions,
} from "@/db/schema";

export type TrafficMarket = {
  organizationId: string;
  domain: string;
  locationCode: number;
  languageCode: string;
};

export type TrafficMonthInsert = typeof trafficHistoryMonths.$inferInsert;
export type TrafficPositionInsert = typeof trafficHistoryPositions.$inferInsert;
export type TrafficCountryInsert = typeof trafficCountryShares.$inferInsert;

const MONTHS_PER_STATEMENT = 9;
const POSITIONS_PER_STATEMENT = 12;
const COUNTRIES_PER_STATEMENT = 12;

function marketWhere<
  T extends
    | typeof trafficHistoryFetches
    | typeof trafficHistoryMonths
    | typeof trafficHistoryPositions,
>(table: T, market: TrafficMarket) {
  return and(
    eq(table.organizationId, market.organizationId),
    eq(table.domain, market.domain),
    eq(table.locationCode, market.locationCode),
    eq(table.languageCode, market.languageCode),
  );
}

async function getFetch(market: TrafficMarket) {
  const [row] = await db
    .select()
    .from(trafficHistoryFetches)
    .where(marketWhere(trafficHistoryFetches, market))
    .limit(1);
  return row ?? null;
}

async function listMonths(market: TrafficMarket) {
  return db
    .select()
    .from(trafficHistoryMonths)
    .where(marketWhere(trafficHistoryMonths, market))
    .orderBy(asc(trafficHistoryMonths.month));
}

async function listPositions(market: TrafficMarket) {
  return db
    .select({
      month: trafficHistoryPositions.month,
      kind: trafficHistoryPositions.kind,
      band: trafficHistoryPositions.band,
      keywords: trafficHistoryPositions.keywords,
    })
    .from(trafficHistoryPositions)
    .where(marketWhere(trafficHistoryPositions, market));
}

async function saveMonths(
  market: TrafficMarket,
  months: TrafficMonthInsert[],
  positions: TrafficPositionInsert[],
  coverage: { coveredFrom: string; lastFetchedAt: string },
) {
  await runBatch((tx) => [
    ...chunk(months, MONTHS_PER_STATEMENT).map((rows) =>
      tx.insert(trafficHistoryMonths).values(rows).onConflictDoNothing(),
    ),
    ...chunk(positions, POSITIONS_PER_STATEMENT).map((rows) =>
      tx.insert(trafficHistoryPositions).values(rows).onConflictDoNothing(),
    ),
    tx
      .insert(trafficHistoryFetches)
      .values({ ...market, ...coverage })
      .onConflictDoUpdate({
        target: [
          trafficHistoryFetches.organizationId,
          trafficHistoryFetches.domain,
          trafficHistoryFetches.locationCode,
          trafficHistoryFetches.languageCode,
        ],
        set: coverage,
      }),
  ]);
}

async function getSnapshot(organizationId: string, domain: string) {
  const [row] = await db
    .select()
    .from(trafficDomainSnapshots)
    .where(
      and(
        eq(trafficDomainSnapshots.organizationId, organizationId),
        eq(trafficDomainSnapshots.domain, domain),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function listCountries(organizationId: string, domain: string) {
  return db
    .select()
    .from(trafficCountryShares)
    .where(
      and(
        eq(trafficCountryShares.organizationId, organizationId),
        eq(trafficCountryShares.domain, domain),
      ),
    );
}

const snapshotTarget = [
  trafficDomainSnapshots.organizationId,
  trafficDomainSnapshots.domain,
];

async function saveCountries(
  organizationId: string,
  domain: string,
  rows: TrafficCountryInsert[],
  fetchedAt: string,
) {
  await runBatch((tx) => [
    tx
      .delete(trafficCountryShares)
      .where(
        and(
          eq(trafficCountryShares.organizationId, organizationId),
          eq(trafficCountryShares.domain, domain),
        ),
      ),
    ...chunk(rows, COUNTRIES_PER_STATEMENT).map((part) =>
      tx.insert(trafficCountryShares).values(part).onConflictDoNothing(),
    ),
    tx
      .insert(trafficDomainSnapshots)
      .values({ organizationId, domain, countriesFetchedAt: fetchedAt })
      .onConflictDoUpdate({
        target: snapshotTarget,
        set: { countriesFetchedAt: fetchedAt },
      }),
  ]);
}

async function saveBacklinks(
  organizationId: string,
  domain: string,
  values: {
    backlinks: number | null;
    referringDomains: number | null;
    domainRank: number | null;
    backlinksFetchedAt: string;
  },
) {
  await db
    .insert(trafficDomainSnapshots)
    .values({ organizationId, domain, ...values })
    .onConflictDoUpdate({ target: snapshotTarget, set: values });
}

async function listNotes(organizationId: string, domain: string) {
  return db
    .select({
      id: trafficHistoryNotes.id,
      month: trafficHistoryNotes.month,
      body: trafficHistoryNotes.body,
      createdAt: trafficHistoryNotes.createdAt,
    })
    .from(trafficHistoryNotes)
    .where(
      and(
        eq(trafficHistoryNotes.organizationId, organizationId),
        eq(trafficHistoryNotes.domain, domain),
      ),
    )
    .orderBy(
      asc(trafficHistoryNotes.month),
      asc(trafficHistoryNotes.createdAt),
    );
}

async function addNote(
  organizationId: string,
  domain: string,
  month: string,
  body: string,
) {
  await db.insert(trafficHistoryNotes).values({
    id: crypto.randomUUID(),
    organizationId,
    domain,
    month,
    body,
    createdAt: new Date().toISOString(),
  });
}

async function deleteNote(organizationId: string, id: string) {
  await db
    .delete(trafficHistoryNotes)
    .where(
      and(
        eq(trafficHistoryNotes.organizationId, organizationId),
        eq(trafficHistoryNotes.id, id),
      ),
    );
}

export const TrafficHistoryRepository = {
  getFetch,
  listMonths,
  listPositions,
  saveMonths,
  getSnapshot,
  listCountries,
  saveCountries,
  saveBacklinks,
  listNotes,
  addNote,
  deleteNote,
} as const;
