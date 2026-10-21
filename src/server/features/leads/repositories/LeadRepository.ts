import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { executeInBatches, runBatch } from "@/db/runBatch";
import { leadEmails, leads, leadSearches } from "@/db/schema";

type SearchInsert = Omit<
  typeof leadSearches.$inferInsert,
  "id" | "projectId" | "createdAt" | "updatedAt"
>;
type LeadInsert = Omit<
  typeof leads.$inferInsert,
  "id" | "projectId" | "searchId" | "createdAt" | "updatedAt"
> & { id?: string };
type EmailInsert = Omit<
  typeof leadEmails.$inferInsert,
  "id" | "leadId" | "createdAt"
>;

const KEY_CHUNK = 90;

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
    .where(eq(leadSearches.projectId, projectId))
    .orderBy(desc(leadSearches.createdAt));
}

async function getSearch(projectId: string, id: string) {
  const [row] = await db
    .select()
    .from(leadSearches)
    .where(and(eq(leadSearches.projectId, projectId), eq(leadSearches.id, id)))
    .limit(1);
  return row ?? null;
}

async function deleteSearch(projectId: string, id: string) {
  await db
    .delete(leadSearches)
    .where(and(eq(leadSearches.projectId, projectId), eq(leadSearches.id, id)));
}

async function existingBusinessKeys(projectId: string, keys: string[]) {
  const found = new Set<string>();
  for (let i = 0; i < keys.length; i += KEY_CHUNK) {
    const chunk = keys.slice(i, i + KEY_CHUNK);
    const rows = await db
      .select({ businessKey: leads.businessKey })
      .from(leads)
      .where(
        and(eq(leads.projectId, projectId), inArray(leads.businessKey, chunk)),
      );
    for (const row of rows) found.add(row.businessKey);
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
      .values({
        ...row,
        id: row.id ?? crypto.randomUUID(),
        projectId,
        searchId,
        createdAt: now,
        updatedAt: now,
      })
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
    .where(and(eq(leads.projectId, projectId), eq(leads.searchId, searchId)))
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
    .where(and(eq(leads.projectId, projectId), eq(leads.searchId, searchId)))
    .orderBy(desc(leadEmails.isPrimary), asc(leadEmails.email));
}

async function listLeadCounts(projectId: string) {
  return db
    .select({
      searchId: leads.searchId,
      enrichmentStatus: leads.enrichmentStatus,
      primaryEmail: leadEmails.email,
    })
    .from(leads)
    .leftJoin(
      leadEmails,
      and(eq(leadEmails.leadId, leads.id), eq(leadEmails.isPrimary, true)),
    )
    .where(eq(leads.projectId, projectId));
}

async function listPendingLeads(
  projectId: string,
  searchId: string,
  limit: number,
) {
  return db
    .select({
      id: leads.id,
      name: leads.name,
      website: leads.website,
      domain: leads.domain,
    })
    .from(leads)
    .where(
      and(
        eq(leads.projectId, projectId),
        eq(leads.searchId, searchId),
        eq(leads.enrichmentStatus, "pending"),
      ),
    )
    .orderBy(asc(leads.createdAt))
    .limit(limit);
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
    >
  >,
  emails: EmailInsert[],
) {
  const now = new Date().toISOString();
  await runBatch((tx) => [
    tx
      .update(leads)
      .set({ ...values, updatedAt: now })
      .where(and(eq(leads.projectId, projectId), eq(leads.id, leadId))),
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

async function touchSearch(projectId: string, id: string) {
  await db
    .update(leadSearches)
    .set({ updatedAt: new Date().toISOString() })
    .where(and(eq(leadSearches.projectId, projectId), eq(leadSearches.id, id)));
}

export const LeadRepository = {
  createSearch,
  listSearches,
  getSearch,
  deleteSearch,
  existingBusinessKeys,
  insertLeads,
  insertFoundEmails,
  listEmailsForLeads,
  listLeads,
  listEmailsForSearch,
  listLeadCounts,
  listPendingLeads,
  saveEnrichment,
  touchSearch,
};
