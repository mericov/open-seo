import { and, asc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { executeInBatches } from "@/db/runBatch";
import { mediaArticles, mediaOutletTopics, mediaOutlets } from "@/db/schema";
import { MediaArticleRepository } from "@/server/features/digital-pr/repositories/MediaArticleRepository";
import type {
  MediaContactRole,
  MediaContactSource,
  MediaOutletSource,
  MediaOutletType,
  PrMarket,
} from "@/shared/digitalPr";

const KEY_CHUNK = 90;

export type OutletSeed = {
  domain: string;
  name: string | null;
  type: MediaOutletType;
  market: PrMarket;
  source: MediaOutletSource;
  homepageUrl: string | null;
  domainRank?: number | null;
};

export type ContactSeed = {
  contactKey: string;
  name: string | null;
  email: string | null;
  jobTitle: string | null;
  role: MediaContactRole;
  source: MediaContactSource;
};

export type ArticleSeed = {
  outletId: string;
  topicId: string | null;
  url: string;
  title: string | null;
  publishedAt: string | null;
};

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += KEY_CHUNK) {
    out.push(items.slice(i, i + KEY_CHUNK));
  }
  return out;
}

async function outletIdsByDomain(organizationId: string, domains: string[]) {
  const found = new Map<string, string>();
  for (const chunk of chunks(domains)) {
    const rows = await db
      .select({ id: mediaOutlets.id, domain: mediaOutlets.domain })
      .from(mediaOutlets)
      .where(
        and(
          eq(mediaOutlets.organizationId, organizationId),
          inArray(mediaOutlets.domain, chunk),
        ),
      );
    for (const row of rows) found.set(row.domain, row.id);
  }
  return found;
}

async function upsertOutlets(
  organizationId: string,
  seeds: OutletSeed[],
  seenAt: string,
) {
  const unique = [...new Map(seeds.map((row) => [row.domain, row])).values()];
  const existing = await outletIdsByDomain(
    organizationId,
    unique.map((row) => row.domain),
  );
  const fresh = unique.filter((row) => !existing.has(row.domain));
  await executeInBatches(fresh, (tx, row) =>
    tx
      .insert(mediaOutlets)
      .values({
        id: crypto.randomUUID(),
        organizationId,
        domain: row.domain,
        name: row.name,
        type: row.type,
        market: row.market,
        source: row.source,
        homepageUrl: row.homepageUrl,
        domainRank: row.domainRank ?? null,
        lastSeenAt: seenAt,
        createdAt: seenAt,
        updatedAt: seenAt,
      })
      .onConflictDoNothing(),
  );
  const seenIds = [...existing.values()];
  for (const chunk of chunks(seenIds)) {
    await db
      .update(mediaOutlets)
      .set({ lastSeenAt: seenAt })
      .where(inArray(mediaOutlets.id, chunk));
  }
  const ids = await outletIdsByDomain(
    organizationId,
    unique.map((row) => row.domain),
  );
  return { ids, addedDomains: fresh.map((row) => row.domain) };
}

async function linkOutletTopics(
  rows: { outletId: string; topicId: string }[],
  seenAt: string,
) {
  const unique = [
    ...new Map(rows.map((row) => [`${row.outletId}|${row.topicId}`, row])),
  ].map(([, row]) => row);
  await executeInBatches(unique, (tx, row) =>
    tx
      .insert(mediaOutletTopics)
      .values({ ...row, lastSeenAt: seenAt })
      .onConflictDoUpdate({
        target: [mediaOutletTopics.outletId, mediaOutletTopics.topicId],
        set: { lastSeenAt: seenAt },
      }),
  );
}

async function insertArticles(seeds: ArticleSeed[]) {
  const unique = [
    ...new Map(seeds.map((row) => [`${row.outletId}|${row.url}`, row])),
  ].map(([, row]) => row);
  const existing = new Set<string>();
  for (const chunk of chunks(unique)) {
    const rows = await db
      .select({ outletId: mediaArticles.outletId, url: mediaArticles.url })
      .from(mediaArticles)
      .where(
        and(
          inArray(
            mediaArticles.outletId,
            chunk.map((row) => row.outletId),
          ),
          inArray(
            mediaArticles.url,
            chunk.map((row) => row.url),
          ),
        ),
      );
    for (const row of rows) existing.add(`${row.outletId}|${row.url}`);
  }
  const fresh = unique.filter(
    (row) => !existing.has(`${row.outletId}|${row.url}`),
  );
  const now = new Date().toISOString();
  await executeInBatches(fresh, (tx, row) =>
    tx
      .insert(mediaArticles)
      .values({ id: crypto.randomUUID(), ...row, createdAt: now })
      .onConflictDoNothing(),
  );
  return fresh.length;
}

async function claimPendingOutlets(
  limit: number,
  now: string,
  staleBefore: string,
  organizationId?: string,
) {
  const candidates = await db
    .select({
      id: mediaOutlets.id,
      enrichClaimedAt: mediaOutlets.enrichClaimedAt,
    })
    .from(mediaOutlets)
    .where(
      and(
        eq(mediaOutlets.enrichStatus, "pending"),
        organizationId
          ? eq(mediaOutlets.organizationId, organizationId)
          : undefined,
        or(
          isNull(mediaOutlets.enrichClaimedAt),
          lt(mediaOutlets.enrichClaimedAt, staleBefore),
        ),
      ),
    )
    .orderBy(asc(mediaOutlets.createdAt))
    .limit(limit);
  const claimed: string[] = [];
  for (const candidate of candidates) {
    const rows = await db
      .update(mediaOutlets)
      .set({ enrichClaimedAt: now })
      .where(
        and(
          eq(mediaOutlets.id, candidate.id),
          candidate.enrichClaimedAt === null
            ? isNull(mediaOutlets.enrichClaimedAt)
            : eq(mediaOutlets.enrichClaimedAt, candidate.enrichClaimedAt),
        ),
      )
      .returning({ id: mediaOutlets.id });
    if (rows.length > 0) claimed.push(candidate.id);
  }
  if (claimed.length === 0) return [];
  return db
    .select()
    .from(mediaOutlets)
    .where(inArray(mediaOutlets.id, claimed));
}

async function saveOutletEnrichment(
  outletId: string,
  values: {
    status: "done" | "failed";
    name: string | null;
    type: MediaOutletType | null;
    homepageUrl: string | null;
    mastheadUrl: string | null;
    contactPageUrl: string | null;
  },
  contacts: ContactSeed[],
) {
  const now = new Date().toISOString();
  await db
    .update(mediaOutlets)
    .set({
      enrichStatus: values.status,
      enrichedAt: now,
      enrichClaimedAt: null,
      mastheadUrl: values.mastheadUrl,
      contactPageUrl: values.contactPageUrl,
      updatedAt: now,
    })
    .where(eq(mediaOutlets.id, outletId));
  if (values.name) {
    await db
      .update(mediaOutlets)
      .set({ name: values.name })
      .where(
        and(
          eq(mediaOutlets.id, outletId),
          isNull(mediaOutlets.editedAt),
          isNull(mediaOutlets.name),
        ),
      );
  }
  if (values.type) {
    await db
      .update(mediaOutlets)
      .set({ type: values.type })
      .where(
        and(
          eq(mediaOutlets.id, outletId),
          isNull(mediaOutlets.editedAt),
          eq(mediaOutlets.type, "other"),
        ),
      );
  }
  if (values.homepageUrl) {
    await db
      .update(mediaOutlets)
      .set({ homepageUrl: values.homepageUrl })
      .where(
        and(eq(mediaOutlets.id, outletId), isNull(mediaOutlets.homepageUrl)),
      );
  }
  await MediaArticleRepository.insertContacts(outletId, contacts);
}

async function setOutletTraffic(
  organizationId: string,
  rows: { domain: string; organicTraffic: number | null }[],
) {
  await executeInBatches(rows, (tx, row) =>
    tx
      .update(mediaOutlets)
      .set({ organicTraffic: row.organicTraffic })
      .where(
        and(
          eq(mediaOutlets.organizationId, organizationId),
          eq(mediaOutlets.domain, row.domain),
        ),
      ),
  );
}

export const MediaRepository = {
  outletIdsByDomain,
  upsertOutlets,
  linkOutletTopics,
  insertArticles,
  claimPendingOutlets,
  saveOutletEnrichment,
  setOutletTraffic,
};
