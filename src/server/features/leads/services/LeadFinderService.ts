import { sortBy } from "remeda";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { getBusinessCategories } from "@/server/lib/dataforseo/businessCategories";
import { AppError } from "@/server/lib/errors";
import { findSiteContacts } from "@/server/lib/leads/contactExtractor";
import { checkEmails, pickPrimaryEmail } from "@/server/lib/leads/emailChecks";
import { findPlaces } from "@/server/lib/leads/geocode";
import { LeadListRepository } from "@/server/features/leads/repositories/LeadListRepository";
import { LeadRepository } from "@/server/features/leads/repositories/LeadRepository";
import { fetchAndSaveLocal } from "@/server/features/leads/services/leadSources";
import {
  opportunityScore,
  sortFindingsByWeight,
  type LeadFindingCode,
} from "@/shared/leadFindings";
import {
  categoriesForSearch,
  type LeadCategoryGroup,
  type LeadNeedFilter,
} from "@/shared/leadScan";
import {
  LEAD_REACHABILITY_ORDER,
  leadReachability,
  type LeadReachability,
} from "@/shared/leads";

// Sites read per enrichment call. Each site costs several subrequests (DNS
// checks, home page, robots.txt, up to three contact pages, store stats, MX
// lookups), so a small batch keeps every call well inside the Workers
// subrequest budget.
export const LEAD_ENRICH_BATCH_SIZE = 3;

type StartLeadSearchInput = {
  projectId: string;
  category?: string;
  categoryGroup?: LeadCategoryGroup;
  needFilter?: LeadNeedFilter;
  nameQuery?: string;
  location: string;
  place?: { label: string; latitude: number; longitude: number };
  radiusKm: number;
  limit: number;
  minRating?: number;
};

async function listCategories(query: string | undefined, limit: number) {
  const all = await getBusinessCategories();
  const needle = query?.trim().toLowerCase().replace(/\s+/g, "_");
  const matched = needle
    ? all.filter((row) => row.category.toLowerCase().includes(needle))
    : all;
  return matched.slice(0, limit);
}

async function startSearch(
  input: StartLeadSearchInput,
  billing: BillingCustomerContext,
) {
  const place = input.place ?? (await findPlaces(input.location))[0];
  if (!place) throw new AppError("LEAD_LOCATION_NOT_FOUND");
  const radiusKm = Math.max(1, Math.round(input.radiusKm));
  const groupLabel = input.categoryGroup
    ? `${humanizeCategory(input.categoryGroup)}`
    : humanizeCategory(input.category ?? "");
  const searchId = await LeadRepository.createSearch(input.projectId, {
    label: `${groupLabel}${input.needFilter ? ` · ${humanizeCategory(input.needFilter)}` : ""} · ${shortPlace(input.location)}`,
    category: input.category ?? input.categoryGroup ?? "all",
    categoryGroup: input.categoryGroup ?? null,
    needFilter: input.needFilter ?? null,
    nameQuery: input.nameQuery || null,
    locationLabel: place.label,
    latitude: place.latitude,
    longitude: place.longitude,
    radiusKm,
    minRating: input.minRating ?? null,
    requestedLimit: input.limit,
  });
  const result = await fetchAndSaveLocal(
    billing,
    { projectId: input.projectId, searchId },
    {
      categories: categoriesForSearch({
        category: input.category ?? "",
        categoryGroup: input.categoryGroup ?? null,
      }),
      nameQuery: input.nameQuery,
      latitude: place.latitude,
      longitude: place.longitude,
      radiusKm,
      minRating: input.minRating,
      needFilter: input.needFilter,
    },
    { limit: input.limit, offset: 0 },
  );
  await LeadRepository.updateSearch(input.projectId, searchId, {
    skippedDuplicates: result.found - result.added,
    nextOffset: result.returned,
  });

  return {
    searchId,
    found: result.found,
    added: result.added,
    skippedDuplicates: result.found - result.added,
  };
}

async function enrichNextBatch(projectId: string, searchId: string) {
  const search = await requireSearch(projectId, searchId);
  const pending = await LeadRepository.listPendingLeads(
    projectId,
    searchId,
    LEAD_ENRICH_BATCH_SIZE,
  );
  const isStoreSearch = search.source === "shopify";
  const knownEmails = isStoreSearch
    ? await LeadRepository.listEmailsForLeads(pending.map((lead) => lead.id))
    : [];

  await Promise.all(
    pending.map(async (lead) => {
      const reviewFindings: LeadFindingCode[] =
        !isStoreSearch && lead.reviewsCount != null && lead.reviewsCount < 10
          ? ["few_reviews"]
          : [];
      if (!lead.website) {
        const findings: LeadFindingCode[] = ["no_website", ...reviewFindings];
        await LeadRepository.saveEnrichment(
          projectId,
          lead.id,
          {
            enrichmentStatus: "no_website",
            opportunityScore: opportunityScore(findings),
          },
          [],
          findings,
        );
        return;
      }
      const contacts = await findSiteContacts(lead.website, {
        shopify: isStoreSearch,
      });
      const siteDomain = lead.domain?.replace(/^www\./, "") ?? null;
      const emails = [
        ...new Set([
          ...knownEmails
            .filter((row) => row.leadId === lead.id)
            .map((row) => row.email),
          ...contacts.emails,
        ]),
      ];
      const checks = await checkEmails(emails, siteDomain);
      const primary = pickPrimaryEmail(checks);
      const store = contacts.shopify;
      const findings =
        contacts.status === "done"
          ? [...contacts.findings, ...reviewFindings]
          : [];
      await LeadRepository.saveEnrichment(
        projectId,
        lead.id,
        {
          enrichmentStatus: contacts.status,
          opportunityScore:
            contacts.status === "done" ? opportunityScore(findings) : null,
          contactPageUrl: contacts.contactPageUrl,
          instagramUrl: contacts.instagramUrl,
          facebookUrl: contacts.facebookUrl,
          linkedinUrl: contacts.linkedinUrl,
          whatsappUrl: contacts.whatsappUrl,
          ...(store
            ? {
                name: store.name ?? lead.name,
                productCount: store.productCount,
                lastProductAt: store.lastProductAt,
                currency: store.currency,
                ...(store.countryCode
                  ? { countryCode: store.countryCode }
                  : {}),
              }
            : {}),
        },
        checks.map((check) => ({
          ...check,
          isPrimary: check.email === primary,
        })),
        findings,
      );
    }),
  );

  if (pending.length > 0) await LeadRepository.touchSearch(projectId, searchId);
  const remaining = await LeadRepository.listPendingLeads(
    projectId,
    searchId,
    1000,
  );
  return { processed: pending.length, remaining: remaining.length };
}

async function listSearches(projectId: string) {
  const [searches, counts] = await Promise.all([
    LeadRepository.listSearches(projectId),
    LeadRepository.listLeadCounts(projectId),
  ]);
  return searches.map((search) => {
    const rows = counts.filter((row) => row.searchId === search.id);
    return {
      id: search.id,
      label: search.label,
      source: search.source,
      category: search.category,
      locationLabel: search.locationLabel,
      radiusKm: search.radiusKm,
      createdAt: search.createdAt,
      updatedAt: search.updatedAt,
      total: rows.length,
      pending: rows.filter((row) => row.enrichmentStatus === "pending").length,
      ready: rows.filter((row) => row.primaryEmail != null).length,
    };
  });
}

async function getSearchDetail(projectId: string, searchId: string) {
  const search = await requireSearch(projectId, searchId);
  const [leadRows, emailRows] = await Promise.all([
    LeadRepository.listLeads(projectId, searchId),
    LeadRepository.listEmailsForSearch(projectId, searchId),
  ]);
  const findingRows = await LeadListRepository.listFindings(
    leadRows.map((lead) => lead.id),
  );

  const leads = leadRows.map((lead) => {
    const emails = emailRows.filter((email) => email.leadId === lead.id);
    const primaryEmail = emails.find((email) => email.isPrimary)?.email ?? null;
    const reachability = leadReachability({
      enrichmentStatus: lead.enrichmentStatus,
      primaryEmail,
      emailCount: emails.length,
      instagramUrl: lead.instagramUrl,
      facebookUrl: lead.facebookUrl,
      whatsappUrl: lead.whatsappUrl,
      phone: lead.phone,
    });
    return {
      id: lead.id,
      name: lead.name,
      category: lead.category,
      address: lead.address,
      phone: lead.phone,
      website: lead.website,
      domain: lead.domain,
      rating: lead.rating,
      reviewsCount: lead.reviewsCount,
      mapsUrl: lead.mapsUrl,
      enrichmentStatus: lead.enrichmentStatus,
      contactPageUrl: lead.contactPageUrl,
      instagramUrl: lead.instagramUrl,
      facebookUrl: lead.facebookUrl,
      linkedinUrl: lead.linkedinUrl,
      whatsappUrl: lead.whatsappUrl,
      countryCode: lead.countryCode,
      domainRank: lead.domainRank,
      productCount: lead.productCount,
      lastProductAt: lead.lastProductAt,
      currency: lead.currency,
      opportunityScore: lead.opportunityScore,
      outreachStatus: lead.outreachStatus,
      findings: sortFindingsByWeight(
        findingRows
          .filter((row) => row.leadId === lead.id)
          .map((row) => row.code),
      ),
      primaryEmail,
      emails: emails.map(({ email, checkStatus, kind, onOwnDomain }) => ({
        email,
        checkStatus,
        kind,
        onOwnDomain,
      })),
      reachability,
    };
  });
  const sortedLeads = sortBy(leads, (lead) =>
    LEAD_REACHABILITY_ORDER.indexOf(lead.reachability),
  );

  const summary: Record<LeadReachability, number> = {
    ready: 0,
    social_only: 0,
    email_unreachable: 0,
    no_contact: 0,
    pending: 0,
  };
  for (const lead of sortedLeads) summary[lead.reachability] += 1;

  return {
    search: {
      id: search.id,
      label: search.label,
      source: search.source,
      category: search.category,
      countryCode: search.countryCode,
      keywordQuery: search.keywordQuery,
      nameQuery: search.nameQuery,
      technology: search.technology,
      categoryGroup: search.categoryGroup,
      needFilter: search.needFilter,
      autoRun: search.autoRun,
      runSize: search.runSize,
      nextRunAt: search.nextRunAt,
      lastRunAt: search.lastRunAt,
      locationLabel: search.locationLabel,
      radiusKm: search.radiusKm,
      requestedLimit: search.requestedLimit,
      skippedDuplicates: search.skippedDuplicates,
      createdAt: search.createdAt,
    },
    summary,
    leads: sortedLeads,
  };
}

async function retryFailed(projectId: string, searchId: string) {
  await requireSearch(projectId, searchId);
  return { reset: await LeadRepository.resetFailedLeads(projectId, searchId) };
}

async function deleteSearch(projectId: string, searchId: string) {
  await requireSearch(projectId, searchId);
  await LeadRepository.deleteSearch(projectId, searchId);
}

async function requireSearch(projectId: string, searchId: string) {
  const search = await LeadRepository.getSearch(projectId, searchId);
  if (!search) throw new AppError("NOT_FOUND");
  return search;
}

function humanizeCategory(category: string) {
  const words = category.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function shortPlace(location: string) {
  return location.split(",")[0]?.trim() || location;
}

export const LeadFinderService = {
  listCategories,
  findLocations: findPlaces,
  startSearch,
  enrichNextBatch,
  listSearches,
  getSearchDetail,
  deleteSearch,
  retryFailed,
};
