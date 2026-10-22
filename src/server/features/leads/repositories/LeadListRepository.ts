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
  sql,
} from "drizzle-orm";
import { chunk } from "remeda";
import { db } from "@/db";
import { leadEmails, leadFindings, leads, leadSearches } from "@/db/schema";
import type {
  LeadFindingCode,
  LeadNoteColor,
  LeadOutreachStatus,
} from "@/shared/leadFindings";

const ID_CHUNK = 90;

export type LeadListFilters = {
  status?: LeadOutreachStatus;
  source?: "local" | "shopify";
  searchId?: string;
  hasEmail?: boolean;
  minScore?: number;
  dueBy?: string;
  finding?: LeadFindingCode;
};

function filterConditions(
  projectId: string,
  filters: Omit<LeadListFilters, "status">,
) {
  return [
    eq(leads.projectId, projectId),
    isNull(leads.hiddenAt),
    filters.dueBy ? lte(leads.remindAt, filters.dueBy) : undefined,
    filters.finding
      ? inArray(
          leads.id,
          db
            .select({ id: leadFindings.leadId })
            .from(leadFindings)
            .where(eq(leadFindings.code, filters.finding)),
        )
      : undefined,
    filters.source ? eq(leadSearches.source, filters.source) : undefined,
    filters.searchId ? eq(leads.searchId, filters.searchId) : undefined,
    filters.hasEmail ? isNotNull(leadEmails.email) : undefined,
    filters.minScore != null
      ? gte(leads.opportunityScore, filters.minScore)
      : undefined,
  ];
}

const searchJoin = eq(leadSearches.id, leads.searchId);
const primaryEmailJoin = and(
  eq(leadEmails.leadId, leads.id),
  eq(leadEmails.isPrimary, true),
);

async function listLeads(
  projectId: string,
  filters: LeadListFilters,
  page: { limit: number; offset: number },
) {
  const where = and(
    ...filterConditions(projectId, filters),
    filters.status ? eq(leads.outreachStatus, filters.status) : undefined,
  );
  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: leads.id,
        name: leads.name,
        category: leads.category,
        website: leads.website,
        domain: leads.domain,
        phone: leads.phone,
        instagramUrl: leads.instagramUrl,
        facebookUrl: leads.facebookUrl,
        linkedinUrl: leads.linkedinUrl,
        whatsappUrl: leads.whatsappUrl,
        mapsUrl: leads.mapsUrl,
        rating: leads.rating,
        reviewsCount: leads.reviewsCount,
        countryCode: leads.countryCode,
        productCount: leads.productCount,
        lastProductAt: leads.lastProductAt,
        enrichmentStatus: leads.enrichmentStatus,
        opportunityScore: leads.opportunityScore,
        outreachStatus: leads.outreachStatus,
        contactedAt: leads.contactedAt,
        firstLine: leads.firstLine,
        noteColor: leads.noteColor,
        noteText: leads.noteText,
        noteUpdatedAt: leads.noteUpdatedAt,
        remindAt: leads.remindAt,
        reportToken: leads.reportToken,
        reportCreatedAt: leads.reportCreatedAt,
        reportViews: leads.reportViews,
        reportLastViewedAt: leads.reportLastViewedAt,
        createdAt: leads.createdAt,
        searchId: leads.searchId,
        searchLabel: leadSearches.label,
        source: leadSearches.source,
        locationLabel: leadSearches.locationLabel,
        primaryEmail: leadEmails.email,
      })
      .from(leads)
      .innerJoin(leadSearches, searchJoin)
      .leftJoin(leadEmails, primaryEmailJoin)
      .where(where)
      .orderBy(
        sql`coalesce(${leads.opportunityScore}, -1) desc`,
        desc(leads.createdAt),
        leads.id,
      )
      .limit(page.limit)
      .offset(page.offset),
    db
      .select({ total: count() })
      .from(leads)
      .innerJoin(leadSearches, searchJoin)
      .leftJoin(leadEmails, primaryEmailJoin)
      .where(where),
  ]);
  return { rows, total: totals?.total ?? 0 };
}

async function statusCounts(
  projectId: string,
  filters: Omit<LeadListFilters, "status">,
) {
  return db
    .select({ status: leads.outreachStatus, total: count() })
    .from(leads)
    .innerJoin(leadSearches, searchJoin)
    .leftJoin(leadEmails, primaryEmailJoin)
    .where(and(...filterConditions(projectId, filters)))
    .groupBy(leads.outreachStatus);
}

async function listFindings(leadIds: string[]) {
  const groups = await Promise.all(
    chunk(leadIds, ID_CHUNK).map((ids) =>
      db
        .select({
          leadId: leadFindings.leadId,
          code: leadFindings.code,
          detail: leadFindings.detail,
        })
        .from(leadFindings)
        .where(inArray(leadFindings.leadId, ids)),
    ),
  );
  return groups.flat();
}

async function setOutreachStatus(
  projectId: string,
  leadIds: string[],
  status: LeadOutreachStatus,
) {
  const now = new Date().toISOString();
  const contactedAt =
    status === "new"
      ? null
      : status === "contacted"
        ? sql`coalesce(${leads.contactedAt}, ${now})`
        : leads.contactedAt;
  for (const ids of chunk(leadIds, ID_CHUNK)) {
    await db
      .update(leads)
      .set({ outreachStatus: status, contactedAt, updatedAt: now })
      .where(and(eq(leads.projectId, projectId), inArray(leads.id, ids)));
  }
}

async function listForFirstLines(projectId: string, leadIds: string[]) {
  const groups = await Promise.all(
    chunk(leadIds, ID_CHUNK).map((ids) =>
      db
        .select({
          id: leads.id,
          name: leads.name,
          category: leads.category,
          domain: leads.domain,
          website: leads.website,
          countryCode: leads.countryCode,
          productCount: leads.productCount,
          rating: leads.rating,
          reviewsCount: leads.reviewsCount,
          source: leadSearches.source,
          locationLabel: leadSearches.locationLabel,
        })
        .from(leads)
        .innerJoin(leadSearches, searchJoin)
        .where(and(eq(leads.projectId, projectId), inArray(leads.id, ids))),
    ),
  );
  return groups.flat();
}

async function setFirstLine(
  projectId: string,
  leadId: string,
  firstLine: string | null,
) {
  await db
    .update(leads)
    .set({ firstLine, updatedAt: new Date().toISOString() })
    .where(and(eq(leads.projectId, projectId), eq(leads.id, leadId)));
}

async function countDue(projectId: string, dueBy: string) {
  const [row] = await db
    .select({ total: count() })
    .from(leads)
    .where(
      and(
        eq(leads.projectId, projectId),
        isNull(leads.hiddenAt),
        lte(leads.remindAt, dueBy),
      ),
    );
  return row?.total ?? 0;
}

async function setHidden(
  projectId: string,
  leadIds: string[],
  hidden: boolean,
) {
  const now = new Date().toISOString();
  for (const ids of chunk(leadIds, ID_CHUNK)) {
    await db
      .update(leads)
      .set({ hiddenAt: hidden ? now : null, updatedAt: now })
      .where(and(eq(leads.projectId, projectId), inArray(leads.id, ids)));
  }
}

async function setNote(
  projectId: string,
  leadId: string,
  note: {
    color: LeadNoteColor | null;
    text: string | null;
    remindAt: string | null;
  },
) {
  const now = new Date().toISOString();
  await db
    .update(leads)
    .set({
      noteColor: note.color,
      noteText: note.text,
      remindAt: note.remindAt,
      noteUpdatedAt: note.color || note.text || note.remindAt ? now : null,
      updatedAt: now,
    })
    .where(and(eq(leads.projectId, projectId), eq(leads.id, leadId)));
}

async function getReportToken(projectId: string, leadId: string) {
  const [row] = await db
    .select({
      reportToken: leads.reportToken,
      domain: leads.domain,
      website: leads.website,
    })
    .from(leads)
    .where(and(eq(leads.projectId, projectId), eq(leads.id, leadId)));
  return row ?? null;
}

async function setReportToken(
  projectId: string,
  leadId: string,
  token: string,
) {
  const now = new Date().toISOString();
  const [current] = await db
    .select({ reportToken: leads.reportToken })
    .from(leads)
    .where(and(eq(leads.projectId, projectId), eq(leads.id, leadId)));
  const newLink = current?.reportToken !== token;
  await db
    .update(leads)
    .set({
      reportToken: token,
      reportCreatedAt: now,
      updatedAt: now,
      ...(newLink ? { reportViews: 0, reportLastViewedAt: null } : {}),
    })
    .where(and(eq(leads.projectId, projectId), eq(leads.id, leadId)));
}

async function reportTokenExists(token: string) {
  const [row] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.reportToken, token))
    .limit(1);
  return Boolean(row);
}

async function recordReportView(token: string) {
  await db
    .update(leads)
    .set({
      reportViews: sql`${leads.reportViews} + 1`,
      reportLastViewedAt: new Date().toISOString(),
    })
    .where(eq(leads.reportToken, token));
}

export const LeadListRepository = {
  listLeads,
  statusCounts,
  listFindings,
  setOutreachStatus,
  listForFirstLines,
  setFirstLine,
  countDue,
  setHidden,
  setNote,
  getReportToken,
  setReportToken,
  reportTokenExists,
  recordReportView,
};
