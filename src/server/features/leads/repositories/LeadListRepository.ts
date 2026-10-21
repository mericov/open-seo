import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  sql,
} from "drizzle-orm";
import { chunk } from "remeda";
import { db } from "@/db";
import { leadEmails, leadFindings, leads, leadSearches } from "@/db/schema";
import type { LeadOutreachStatus } from "@/shared/leadFindings";

const ID_CHUNK = 90;

export type LeadListFilters = {
  status?: LeadOutreachStatus;
  source?: "local" | "shopify";
  searchId?: string;
  hasEmail?: boolean;
  minScore?: number;
};

function filterConditions(
  projectId: string,
  filters: Omit<LeadListFilters, "status">,
) {
  return [
    eq(leads.projectId, projectId),
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
        .select({ leadId: leadFindings.leadId, code: leadFindings.code })
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

export const LeadListRepository = {
  listLeads,
  statusCounts,
  listFindings,
  setOutreachStatus,
  listForFirstLines,
  setFirstLine,
};
