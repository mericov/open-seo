import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import {
  mediaArticles,
  mediaContacts,
  mediaOutletTopics,
  mediaOutlets,
  mediaTopics,
} from "@/db/schema";
import type {
  MediaContactRole,
  MediaOutletType,
  PrMarket,
} from "@/shared/digitalPr";

export type OutletListFilters = {
  market?: PrMarket;
  type?: MediaOutletType;
  topicId?: string;
  query?: string;
  hasEmail?: boolean;
  showHidden?: boolean;
  minTraffic?: number;
};

function outletWhere(organizationId: string, filters: OutletListFilters) {
  const needle = filters.query?.trim().toLowerCase();
  return and(
    eq(mediaOutlets.organizationId, organizationId),
    filters.showHidden
      ? isNotNull(mediaOutlets.hiddenAt)
      : isNull(mediaOutlets.hiddenAt),
    filters.market ? eq(mediaOutlets.market, filters.market) : undefined,
    filters.type ? eq(mediaOutlets.type, filters.type) : undefined,
    filters.minTraffic !== undefined
      ? gte(mediaOutlets.organicTraffic, filters.minTraffic)
      : undefined,
    needle
      ? or(
          like(mediaOutlets.domain, `%${needle}%`),
          like(sql`lower(${mediaOutlets.name})`, `%${needle}%`),
        )
      : undefined,
    filters.topicId
      ? inArray(
          mediaOutlets.id,
          db
            .select({ id: mediaOutletTopics.outletId })
            .from(mediaOutletTopics)
            .where(eq(mediaOutletTopics.topicId, filters.topicId)),
        )
      : undefined,
    filters.hasEmail
      ? inArray(
          mediaOutlets.id,
          db
            .select({ id: mediaContacts.outletId })
            .from(mediaContacts)
            .where(
              and(
                isNotNull(mediaContacts.email),
                isNull(mediaContacts.hiddenAt),
              ),
            ),
        )
      : undefined,
  );
}

async function listOutlets(
  organizationId: string,
  filters: OutletListFilters,
  page: { limit: number; offset: number },
) {
  const where = outletWhere(organizationId, filters);
  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(mediaOutlets)
      .where(where)
      .orderBy(
        sql`${mediaOutlets.organicTraffic} is null`,
        desc(mediaOutlets.organicTraffic),
        asc(mediaOutlets.domain),
      )
      .limit(page.limit)
      .offset(page.offset),
    db.select({ total: count() }).from(mediaOutlets).where(where),
  ]);
  return { rows, total: totals?.total ?? 0 };
}

async function listContactsForOutlets(outletIds: string[]) {
  if (outletIds.length === 0) return [];
  return db
    .select()
    .from(mediaContacts)
    .where(
      and(
        inArray(mediaContacts.outletId, outletIds),
        isNull(mediaContacts.hiddenAt),
      ),
    )
    .orderBy(
      desc(mediaContacts.articleCount),
      asc(mediaContacts.role),
      asc(mediaContacts.name),
    );
}

async function listTopicsForOutlets(outletIds: string[]) {
  if (outletIds.length === 0) return [];
  return db
    .select({
      outletId: mediaOutletTopics.outletId,
      topicId: mediaOutletTopics.topicId,
      keyword: mediaTopics.keyword,
    })
    .from(mediaOutletTopics)
    .innerJoin(mediaTopics, eq(mediaTopics.id, mediaOutletTopics.topicId))
    .where(inArray(mediaOutletTopics.outletId, outletIds));
}

async function listRecentArticles(contactIds: string[], perContact: number) {
  if (contactIds.length === 0) return [];
  const rows = await db
    .select({
      contactId: mediaArticles.contactId,
      title: mediaArticles.title,
      url: mediaArticles.url,
      publishedAt: mediaArticles.publishedAt,
    })
    .from(mediaArticles)
    .where(inArray(mediaArticles.contactId, contactIds))
    .orderBy(desc(mediaArticles.publishedAt));
  const counts = new Map<string, number>();
  return rows.filter((row) => {
    if (!row.contactId) return false;
    const seen = counts.get(row.contactId) ?? 0;
    if (seen >= perContact) return false;
    counts.set(row.contactId, seen + 1);
    return true;
  });
}

async function getOutlet(organizationId: string, outletId: string) {
  const [row] = await db
    .select()
    .from(mediaOutlets)
    .where(
      and(
        eq(mediaOutlets.organizationId, organizationId),
        eq(mediaOutlets.id, outletId),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function updateOutlet(
  organizationId: string,
  outletId: string,
  values: {
    name: string | null;
    type: MediaOutletType;
    market: PrMarket;
    notes: string | null;
  },
) {
  const now = new Date().toISOString();
  await db
    .update(mediaOutlets)
    .set({ ...values, editedAt: now, updatedAt: now })
    .where(
      and(
        eq(mediaOutlets.organizationId, organizationId),
        eq(mediaOutlets.id, outletId),
      ),
    );
}

async function setOutletsHidden(
  organizationId: string,
  outletIds: string[],
  hidden: boolean,
) {
  if (outletIds.length === 0) return;
  await db
    .update(mediaOutlets)
    .set({ hiddenAt: hidden ? new Date().toISOString() : null })
    .where(
      and(
        eq(mediaOutlets.organizationId, organizationId),
        inArray(mediaOutlets.id, outletIds),
      ),
    );
}

async function resetOutletsForRescan(
  organizationId: string,
  outletIds: string[],
) {
  if (outletIds.length === 0) return;
  await db
    .update(mediaOutlets)
    .set({ enrichStatus: "pending", enrichClaimedAt: null })
    .where(
      and(
        eq(mediaOutlets.organizationId, organizationId),
        inArray(mediaOutlets.id, outletIds),
      ),
    );
}

async function getContact(organizationId: string, contactId: string) {
  const [row] = await db
    .select({ contact: mediaContacts })
    .from(mediaContacts)
    .innerJoin(mediaOutlets, eq(mediaOutlets.id, mediaContacts.outletId))
    .where(
      and(
        eq(mediaOutlets.organizationId, organizationId),
        eq(mediaContacts.id, contactId),
      ),
    )
    .limit(1);
  return row?.contact ?? null;
}

async function saveContact(
  outletId: string,
  contactId: string | null,
  values: {
    name: string | null;
    email: string | null;
    jobTitle: string | null;
    role: MediaContactRole;
  },
) {
  const now = new Date().toISOString();
  if (contactId) {
    await db
      .update(mediaContacts)
      .set({ ...values, editedAt: now, updatedAt: now })
      .where(eq(mediaContacts.id, contactId));
    return contactId;
  }
  const id = crypto.randomUUID();
  await db.insert(mediaContacts).values({
    id,
    outletId,
    contactKey: `manual:${id}`,
    ...values,
    source: "manual",
    editedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

async function setContactHidden(contactId: string, hidden: boolean) {
  await db
    .update(mediaContacts)
    .set({ hiddenAt: hidden ? new Date().toISOString() : null })
    .where(eq(mediaContacts.id, contactId));
}

async function outletsInOrg(organizationId: string, outletIds: string[]) {
  if (outletIds.length === 0) return [];
  return db
    .select({ id: mediaOutlets.id })
    .from(mediaOutlets)
    .where(
      and(
        eq(mediaOutlets.organizationId, organizationId),
        inArray(mediaOutlets.id, outletIds),
      ),
    );
}

async function contactsInOrg(organizationId: string, contactIds: string[]) {
  if (contactIds.length === 0) return [];
  return db
    .select({ id: mediaContacts.id, outletId: mediaContacts.outletId })
    .from(mediaContacts)
    .innerJoin(mediaOutlets, eq(mediaOutlets.id, mediaContacts.outletId))
    .where(
      and(
        eq(mediaOutlets.organizationId, organizationId),
        inArray(mediaContacts.id, contactIds),
      ),
    );
}

export const MediaLibraryRepository = {
  listOutlets,
  listContactsForOutlets,
  listTopicsForOutlets,
  listRecentArticles,
  getOutlet,
  updateOutlet,
  setOutletsHidden,
  resetOutletsForRescan,
  getContact,
  saveContact,
  setContactHidden,
  outletsInOrg,
  contactsInOrg,
};
