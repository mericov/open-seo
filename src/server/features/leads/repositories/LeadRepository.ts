import { and, asc, count, desc, eq, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { executeInBatches, runBatch } from "@/db/runBatch";
import {
  leadEmails,
  leadFindings,
  leads,
  leadSearches,
  leadSearchLeads,
  projects,
} from "@/db/schema";
import type { LeadFinding } from "@/shared/leadFindings";

type SearchInsert = Omit<
  typeof leadSearches.$inferInsert,
  "id" | "projectId" | "createdAt" | "updatedAt"
>;
type LeadInsert = Omit<
  typeof leads.$inferInsert,
  "id" | "projectId" | "searchId" | "createdAt" | "updatedAt"
> & { id: string };
type EmailInsert = Omit<
  typeof leadEmails.$inferInsert,
  "id" | "leadId" | "createdAt"
>;

const KEY_CHUNK = 90;

const inSearch = (searchId: string) =>
  inArray(
    leads.id,
    db
      .select({ id: leadSearchLeads.leadId })
      .from(leadSearchLeads)
      .where(eq(leadSearchLeads.searchId, searchId)),
  );

async function createSearch(projectId: string, values: SearchInsert) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db
    .insert(leadSearches)
    .values({ id, projectId, ...values, createdAt: now, updatedAt: now });
  return id;
}

async function listSearches(projectId: string) {
  return db
    .select()
    .from(leadSearches)
    .where(
      and(
        eq(leadSearches.projectId, projectId),
        isNull(leadSearches.archivedAt),
      ),
    )
    .orderBy(desc(leadSearches.createdAt));
}

async function getSearch(projectId: string, id: string) {
  const [row] = await db
    .select()
    .from(leadSearches)
    .where(
      and(
        eq(leadSearches.projectId, projectId),
        eq(leadSearches.id, id),
        isNull(leadSearches.archivedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function archiveSearch(projectId: string, id: string) {
  const now = new Date().toISOString();
  await db
    .update(leadSearches)
    .set({ archivedAt: now, autoRun: false, nextRunAt: null, updatedAt: now })
    .where(and(eq(leadSearches.projectId, projectId), eq(leadSearches.id, id)));
}

async function findLeadIdsByKeys(projectId: string, keys: string[]) {
  const found = new Map<string, string>();
  for (let i = 0; i < keys.length; i += KEY_CHUNK) {
    const chunk = keys.slice(i, i + KEY_CHUNK);
    const rows = await db
      .select({ id: leads.id, businessKey: leads.businessKey })
      .from(leads)
      .where(
        and(eq(leads.projectId, projectId), inArray(leads.businessKey, chunk)),
      );
    for (const row of rows) found.set(row.businessKey, row.id);
  }
  return found;
}

async function insertLeads(
  projectId: string,
  searchId: string,
  rows: LeadInsert[],
) {
  const now = new Date().toISOString();
  await executeInBatches(rows, (tx, row) =>
    tx
      .insert(leads)
      .values({ ...row, projectId, searchId, createdAt: now, updatedAt: now })
      .onConflictDoNothing(),
  );
}

async function insertFoundEmails(rows: (EmailInsert & { leadId: string })[]) {
  const now = new Date().toISOString();
  await executeInBatches(rows, (tx, row) =>
    tx
      .insert(leadEmails)
      .values({ ...row, id: crypto.randomUUID(), createdAt: now })
      .onConflictDoNothing(),
  );
}

async function listEmailsForLeads(leadIds: string[]) {
  if (leadIds.length === 0) return [];
  return db
    .select({ leadId: leadEmails.leadId, email: leadEmails.email })
    .from(leadEmails)
    .where(inArray(leadEmails.leadId, leadIds));
}

async function listLeads(projectId: string, searchId: string) {
  return db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.projectId, projectId),
        inSearch(searchId),
        isNull(leads.hiddenAt),
      ),
    )
    .orderBy(asc(leads.createdAt), asc(leads.name));
}

async function listEmailsForSearch(projectId: string, searchId: string) {
  return db
    .select({
      leadId: leadEmails.leadId,
      email: leadEmails.email,
      checkStatus: leadEmails.checkStatus,
      kind: leadEmails.kind,
      onOwnDomain: leadEmails.onOwnDomain,
      isPrimary: leadEmails.isPrimary,
    })
    .from(leadEmails)
    .innerJoin(leads, eq(leads.id, leadEmails.leadId))
    .where(and(eq(leads.projectId, projectId), inSearch(searchId)))
    .orderBy(desc(leadEmails.isPrimary), asc(leadEmails.email));
}

async function listLeadCounts(projectId: string) {
  return db
    .select({
      searchId: leadSearchLeads.searchId,
      enrichmentStatus: leads.enrichmentStatus,
      primaryEmail: leadEmails.email,
    })
    .from(leadSearchLeads)
    .innerJoin(leads, eq(leads.id, leadSearchLeads.leadId))
    .leftJoin(
      leadEmails,
      and(eq(leadEmails.leadId, leads.id), eq(leadEmails.isPrimary, true)),
    )
    .where(eq(leads.projectId, projectId));
}

async function poolCounts(projectId: string, searchId: string) {
  const base = and(
    eq(leads.projectId, projectId),
    inSearch(searchId),
    isNull(leads.hiddenAt),
  );
  const [[ready], [pending]] = await Promise.all([
    db
      .select({ total: count() })
      .from(leads)
      .innerJoin(
        leadEmails,
        and(eq(leadEmails.leadId, leads.id), eq(leadEmails.isPrimary, true)),
      )
      .where(and(base, eq(leads.outreachStatus, "new"))),
    db
      .select({ total: count() })
      .from(leads)
      .where(and(base, eq(leads.enrichmentStatus, "pending"))),
  ]);
  return { ready: ready?.total ?? 0, pending: pending?.total ?? 0 };
}

const enrichFields = {
  id: leads.id,
  name: leads.name,
  website: leads.website,
  domain: leads.domain,
  category: leads.category,
  countryCode: leads.countryCode,
  rating: leads.rating,
  reviewsCount: leads.reviewsCount,
  isClaimed: leads.isClaimed,
  photosCount: leads.photosCount,
  hoursListed: leads.hoursListed,
};

async function listPendingLeads(
  projectId: string,
  searchId: string,
  limit: number,
) {
  return db
    .select(enrichFields)
    .from(leads)
    .where(
      and(
        eq(leads.projectId, projectId),
        inSearch(searchId),
        eq(leads.enrichmentStatus, "pending"),
      ),
    )
    .orderBy(asc(leads.createdAt))
    .limit(limit);
}

async function listLeadsToRescan(projectId: string, leadIds: string[]) {
  return db
    .select({ ...enrichFields, source: leadSearches.source })
    .from(leads)
    .innerJoin(leadSearches, eq(leadSearches.id, leads.searchId))
    .where(and(eq(leads.projectId, projectId), inArray(leads.id, leadIds)));
}

async function saveEnrichment(
  projectId: string,
  leadId: string,
  values: Partial<
    Pick<
      LeadInsert,
      | "enrichmentStatus"
      | "contactPageUrl"
      | "instagramUrl"
      | "facebookUrl"
      | "linkedinUrl"
      | "whatsappUrl"
      | "name"
      | "countryCode"
      | "productCount"
      | "lastProductAt"
      | "currency"
      | "opportunityScore"
    >
  >,
  emails: EmailInsert[],
  findings: LeadFinding[] = [],
) {
  const now = new Date().toISOString();
  await runBatch((tx) => [
    tx
      .update(leads)
      .set({ ...values, updatedAt: now })
      .where(and(eq(leads.projectId, projectId), eq(leads.id, leadId))),
    tx.delete(leadFindings).where(eq(leadFindings.leadId, leadId)),
    ...findings.map(({ code, detail }) =>
      tx
        .insert(leadFindings)
        .values({
          id: crypto.randomUUID(),
          leadId,
          code,
          detail: detail ?? null,
          createdAt: now,
        })
        .onConflictDoNothing(),
    ),
    ...emails.map((email) =>
      tx
        .insert(leadEmails)
        .values({ id: crypto.randomUUID(), leadId, ...email, createdAt: now })
        .onConflictDoUpdate({
          target: [leadEmails.leadId, leadEmails.email],
          set: {
            checkStatus: email.checkStatus,
            kind: email.kind,
            onOwnDomain: email.onOwnDomain,
            isPrimary: email.isPrimary,
          },
        }),
    ),
  ]);
}

async function updateSearch(
  projectId: string,
  id: string,
  values: Partial<SearchInsert>,
) {
  await db
    .update(leadSearches)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(and(eq(leadSearches.projectId, projectId), eq(leadSearches.id, id)));
}

async function touchSearch(projectId: string, id: string) {
  await db
    .update(leadSearches)
    .set({ updatedAt: new Date().toISOString() })
    .where(and(eq(leadSearches.projectId, projectId), eq(leadSearches.id, id)));
}

async function listDueSearches(now: string, limit: number) {
  return db
    .select({ search: leadSearches, organizationId: projects.organizationId })
    .from(leadSearches)
    .innerJoin(projects, eq(projects.id, leadSearches.projectId))
    .where(
      and(
        eq(leadSearches.autoRun, true),
        lte(leadSearches.nextRunAt, now),
        isNull(leadSearches.archivedAt),
        isNull(projects.archivedAt),
      ),
    )
    .orderBy(asc(leadSearches.nextRunAt))
    .limit(limit);
}

async function claimDueSearch(
  id: string,
  observedNextRunAt: string,
  nextRunAt: string,
) {
  const rows = await db
    .update(leadSearches)
    .set({ nextRunAt })
    .where(
      and(
        eq(leadSearches.id, id),
        eq(leadSearches.nextRunAt, observedNextRunAt),
      ),
    )
    .returning({ id: leadSearches.id });
  return rows.length > 0;
}

async function findAutoRunSearchWithPending() {
  const [row] = await db
    .select({ projectId: leads.projectId, searchId: leadSearchLeads.searchId })
    .from(leadSearchLeads)
    .innerJoin(leads, eq(leads.id, leadSearchLeads.leadId))
    .innerJoin(leadSearches, eq(leadSearches.id, leadSearchLeads.searchId))
    .where(
      and(
        eq(leadSearches.autoRun, true),
        isNull(leadSearches.archivedAt),
        eq(leads.enrichmentStatus, "pending"),
      ),
    )
    .orderBy(asc(leads.createdAt))
    .limit(1);
  return row ?? null;
}

async function resetFailedLeads(projectId: string, searchId: string) {
  const rows = await db
    .update(leads)
    .set({ enrichmentStatus: "pending", updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(leads.projectId, projectId),
        inSearch(searchId),
        eq(leads.enrichmentStatus, "failed"),
      ),
    )
    .returning({ id: leads.id });
  return rows.length;
}

export const LeadRepository = {
  createSearch,
  listSearches,
  getSearch,
  archiveSearch,
  findLeadIdsByKeys,
  insertLeads,
  insertFoundEmails,
  listEmailsForLeads,
  listLeads,
  listEmailsForSearch,
  listLeadCounts,
  poolCounts,
  listPendingLeads,
  listLeadsToRescan,
  saveEnrichment,
  touchSearch,
  updateSearch,
  listDueSearches,
  claimDueSearch,
  findAutoRunSearchWithPending,
  resetFailedLeads,
};
