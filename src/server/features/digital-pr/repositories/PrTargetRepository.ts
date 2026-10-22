import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
} from "drizzle-orm";
import { db } from "@/db";
import { executeInBatches } from "@/db/runBatch";
import { mediaContacts, mediaOutlets, prTargets, projects } from "@/db/schema";
import type { PrTargetSource, PrTargetStatus } from "@/shared/digitalPr";

function targetKeyFor(outletId: string, contactId: string | null) {
  return contactId ?? `outlet:${outletId}`;
}

async function addTargets(
  projectId: string,
  rows: {
    outletId: string;
    contactId: string | null;
    source: PrTargetSource;
  }[],
) {
  const unique = [
    ...new Map(
      rows.map((row) => [targetKeyFor(row.outletId, row.contactId), row]),
    ).entries(),
  ];
  const keys = unique.map(([key]) => key);
  const existing = new Set<string>();
  for (let i = 0; i < keys.length; i += 90) {
    const found = await db
      .select({ targetKey: prTargets.targetKey })
      .from(prTargets)
      .where(
        and(
          eq(prTargets.projectId, projectId),
          inArray(prTargets.targetKey, keys.slice(i, i + 90)),
        ),
      );
    for (const row of found) existing.add(row.targetKey);
  }
  const fresh = unique.filter(([key]) => !existing.has(key));
  const now = new Date().toISOString();
  await executeInBatches(fresh, (tx, [targetKey, row]) =>
    tx
      .insert(prTargets)
      .values({
        id: crypto.randomUUID(),
        projectId,
        outletId: row.outletId,
        contactId: row.contactId,
        targetKey,
        source: row.source,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing(),
  );
  return { added: fresh.length, skipped: unique.length - fresh.length };
}

export type TargetListFilters = {
  status?: PrTargetStatus;
  source?: PrTargetSource;
  dueBy?: string;
  hasEmail?: boolean;
};

function targetWhere(projectId: string, filters: TargetListFilters) {
  return and(
    eq(prTargets.projectId, projectId),
    isNull(prTargets.hiddenAt),
    filters.status ? eq(prTargets.status, filters.status) : undefined,
    filters.source ? eq(prTargets.source, filters.source) : undefined,
    filters.dueBy
      ? and(
          isNotNull(prTargets.remindAt),
          lte(prTargets.remindAt, filters.dueBy),
        )
      : undefined,
    filters.hasEmail ? isNotNull(mediaContacts.email) : undefined,
  );
}

async function listTargets(
  projectId: string,
  filters: TargetListFilters,
  page: { limit: number; offset: number },
) {
  const where = targetWhere(projectId, filters);
  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: prTargets.id,
        outletId: prTargets.outletId,
        contactId: prTargets.contactId,
        source: prTargets.source,
        status: prTargets.status,
        pitch: prTargets.pitch,
        noteText: prTargets.noteText,
        remindAt: prTargets.remindAt,
        contactedAt: prTargets.contactedAt,
        createdAt: prTargets.createdAt,
        outletDomain: mediaOutlets.domain,
        outletName: mediaOutlets.name,
        outletType: mediaOutlets.type,
        market: mediaOutlets.market,
        organicTraffic: mediaOutlets.organicTraffic,
        enrichStatus: mediaOutlets.enrichStatus,
        contactName: mediaContacts.name,
        contactEmail: mediaContacts.email,
        contactRole: mediaContacts.role,
        jobTitle: mediaContacts.jobTitle,
      })
      .from(prTargets)
      .innerJoin(mediaOutlets, eq(mediaOutlets.id, prTargets.outletId))
      .leftJoin(mediaContacts, eq(mediaContacts.id, prTargets.contactId))
      .where(where)
      .orderBy(desc(prTargets.updatedAt))
      .limit(page.limit)
      .offset(page.offset),
    db
      .select({ total: count() })
      .from(prTargets)
      .innerJoin(mediaOutlets, eq(mediaOutlets.id, prTargets.outletId))
      .leftJoin(mediaContacts, eq(mediaContacts.id, prTargets.contactId))
      .where(where),
  ]);
  return { rows, total: totals?.total ?? 0 };
}

async function statusCounts(projectId: string) {
  return db
    .select({ status: prTargets.status, total: count() })
    .from(prTargets)
    .where(and(eq(prTargets.projectId, projectId), isNull(prTargets.hiddenAt)))
    .groupBy(prTargets.status);
}

async function countDue(projectId: string, today: string) {
  const [row] = await db
    .select({ total: count() })
    .from(prTargets)
    .where(
      and(
        eq(prTargets.projectId, projectId),
        isNull(prTargets.hiddenAt),
        isNotNull(prTargets.remindAt),
        lte(prTargets.remindAt, today),
      ),
    );
  return row?.total ?? 0;
}

async function emailsForOutlets(outletIds: string[]) {
  if (outletIds.length === 0) return [];
  return db
    .select({
      outletId: mediaContacts.outletId,
      email: mediaContacts.email,
      name: mediaContacts.name,
      role: mediaContacts.role,
    })
    .from(mediaContacts)
    .where(
      and(
        inArray(mediaContacts.outletId, outletIds),
        isNotNull(mediaContacts.email),
        isNull(mediaContacts.hiddenAt),
      ),
    );
}

async function recentContactsElsewhere(
  projectId: string,
  organizationId: string,
  keys: { contactIds: string[]; outletIds: string[] },
  since: string,
) {
  if (keys.contactIds.length === 0 && keys.outletIds.length === 0) return [];
  return db
    .select({
      contactId: prTargets.contactId,
      outletId: prTargets.outletId,
      contactedAt: prTargets.contactedAt,
      projectName: projects.name,
    })
    .from(prTargets)
    .innerJoin(projects, eq(projects.id, prTargets.projectId))
    .where(
      and(
        eq(projects.organizationId, organizationId),
        ne(prTargets.projectId, projectId),
        isNotNull(prTargets.contactedAt),
        gte(prTargets.contactedAt, since),
        or(
          keys.contactIds.length > 0
            ? inArray(prTargets.contactId, keys.contactIds)
            : undefined,
          keys.outletIds.length > 0
            ? inArray(prTargets.outletId, keys.outletIds)
            : undefined,
        ),
      ),
    );
}

async function getTargets(projectId: string, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(prTargets)
    .where(and(eq(prTargets.projectId, projectId), inArray(prTargets.id, ids)));
}

async function setStatus(
  projectId: string,
  ids: string[],
  status: PrTargetStatus,
  extra: { contactedAt?: string; remindAt?: string | null },
) {
  if (ids.length === 0) return;
  const now = new Date().toISOString();
  await db
    .update(prTargets)
    .set({
      status,
      updatedAt: now,
      ...(extra.contactedAt ? { contactedAt: extra.contactedAt } : {}),
      ...(extra.remindAt !== undefined ? { remindAt: extra.remindAt } : {}),
    })
    .where(and(eq(prTargets.projectId, projectId), inArray(prTargets.id, ids)));
}

async function setNote(
  projectId: string,
  id: string,
  values: { noteText: string | null; remindAt: string | null },
) {
  await db
    .update(prTargets)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(and(eq(prTargets.projectId, projectId), eq(prTargets.id, id)));
}

async function setPitch(projectId: string, id: string, pitch: string | null) {
  await db
    .update(prTargets)
    .set({ pitch, updatedAt: new Date().toISOString() })
    .where(and(eq(prTargets.projectId, projectId), eq(prTargets.id, id)));
}

async function markDrafted(projectId: string, ids: string[]) {
  if (ids.length === 0) return;
  await db
    .update(prTargets)
    .set({ status: "drafted" })
    .where(
      and(
        eq(prTargets.projectId, projectId),
        inArray(prTargets.id, ids),
        eq(prTargets.status, "new"),
      ),
    );
}

async function removeTargets(projectId: string, ids: string[]) {
  if (ids.length === 0) return;
  await db
    .delete(prTargets)
    .where(and(eq(prTargets.projectId, projectId), inArray(prTargets.id, ids)));
}

async function listForPitches(projectId: string, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select({
      id: prTargets.id,
      contactId: prTargets.contactId,
      outletDomain: mediaOutlets.domain,
      outletName: mediaOutlets.name,
      outletType: mediaOutlets.type,
      market: mediaOutlets.market,
      contactName: mediaContacts.name,
      contactRole: mediaContacts.role,
      jobTitle: mediaContacts.jobTitle,
    })
    .from(prTargets)
    .innerJoin(mediaOutlets, eq(mediaOutlets.id, prTargets.outletId))
    .leftJoin(mediaContacts, eq(mediaContacts.id, prTargets.contactId))
    .where(and(eq(prTargets.projectId, projectId), inArray(prTargets.id, ids)));
}

async function targetedOutletIds(projectId: string, outletIds: string[]) {
  if (outletIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ outletId: prTargets.outletId })
    .from(prTargets)
    .where(
      and(
        eq(prTargets.projectId, projectId),
        inArray(prTargets.outletId, outletIds),
      ),
    );
  return new Set(rows.map((row) => row.outletId));
}

async function targetedContactIds(projectId: string, contactIds: string[]) {
  if (contactIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ contactId: prTargets.contactId })
    .from(prTargets)
    .where(
      and(
        eq(prTargets.projectId, projectId),
        inArray(prTargets.contactId, contactIds),
      ),
    );
  return new Set(rows.flatMap((row) => (row.contactId ? [row.contactId] : [])));
}

export const PrTargetRepository = {
  addTargets,
  listTargets,
  statusCounts,
  countDue,
  emailsForOutlets,
  recentContactsElsewhere,
  getTargets,
  setStatus,
  setNote,
  setPitch,
  markDrafted,
  removeTargets,
  listForPitches,
  targetedOutletIds,
  targetedContactIds,
};
