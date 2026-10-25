import { sortBy } from "remeda";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { getBusinessCategories } from "@/server/lib/dataforseo/businessCategories";
import { AppError } from "@/server/lib/errors";
import { findSiteContacts } from "@/server/lib/leads/contactExtractor";
import { checkEmails, pickPrimaryEmail } from "@/server/lib/leads/emailChecks";
import { findPlaces } from "@/server/lib/leads/geocode";
import { listingFindings } from "@/server/lib/leads/listingSignals";
import { LeadListRepository } from "@/server/features/leads/repositories/LeadListRepository";
import { LeadRepository } from "@/server/features/leads/repositories/LeadRepository";
import { ContactRegistryService } from "@/server/features/leads/services/ContactRegistryService";
import { leadAreasFor } from "@/shared/leadAreas";
import { leadEmailLanguage } from "@/shared/leadEmail";
import { fetchAndSaveLocal } from "@/server/features/leads/services/leadSources";
import {
  opportunityScore,
  findingsForLead,
  type LeadFinding,
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
export const LEAD_ENRICH_BATCH_SIZE = 2;

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
    preset: "local_service",
  });
  const result = await fetchAndSaveLocal(
    billing,
    {
      organizationId: billing.organizationId,
      projectId: input.projectId,
      searchId,
    },
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

type EnrichLead = Awaited<
  ReturnType<typeof LeadRepository.listPendingLeads>
>[number];

async function enrichLead(
  projectId: string,
  lead: EnrichLead,
  isStore: boolean,
  knownEmails: string[],
) {
  const listing = isStore ? [] : listingFindings(lead);
  if (!lead.website) {
    const findings: LeadFinding[] = [{ code: "no_website" }, ...listing];
    await LeadRepository.saveEnrichment(
      projectId,
      lead.id,
      {
        enrichmentStatus: "no_website",
        opportunityScore: opportunityScore(findings.map((f) => f.code)),
      },
      [],
      findings,
    );
    return;
  }
  const contacts = await findSiteContacts(lead.website, {
    shopify: isStore,
    category: lead.category,
    countryCode: lead.countryCode,
  });
  const siteDomain = lead.domain?.replace(/^www\./, "") ?? null;
  const emails = [...new Set([...knownEmails, ...contacts.emails])];
  const checks = await checkEmails(emails, siteDomain);
  const primary = pickPrimaryEmail(checks);
  const store = contacts.shopify;
  const freeContact =
    checks.length > 0 && !checks.some((check) => check.onOwnDomain)
      ? checks.find((check) => check.kind === "free_provider")
      : undefined;
  const findings: LeadFinding[] =
    contacts.status === "done"
      ? [
          ...contacts.findings,
          ...listing,
          ...(freeContact
            ? [
                {
                  code: "free_email_contact" as const,
                  detail: freeContact.email.split("@")[1] ?? null,
                },
              ]
            : []),
        ]
      : [];
  await LeadRepository.saveEnrichment(
    projectId,
    lead.id,
    {
      enrichmentStatus: contacts.status,
      opportunityScore:
        contacts.status === "done"
          ? opportunityScore(findings.map((f) => f.code))
          : null,
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
            ...(store.countryCode ? { countryCode: store.countryCode } : {}),
          }
        : {}),
    },
    checks.map((check) => ({
      ...check,
      isPrimary: check.email === primary,
    })),
    findings,
  );
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
    pending.map((lead) =>
      enrichLead(
        projectId,
        lead,
        isStoreSearch,
        knownEmails
          .filter((row) => row.leadId === lead.id)
          .map((row) => row.email),
      ),
    ),
  );

  if (pending.length > 0) await LeadRepository.touchSearch(projectId, searchId);
  const remaining = await LeadRepository.listPendingLeads(
    projectId,
    searchId,
    1000,
  );
  return { processed: pending.length, remaining: remaining.length };
}

async function rescanLeads(projectId: string, leadIds: string[]) {
  const rows = await LeadRepository.listLeadsToRescan(
    projectId,
    leadIds.slice(0, LEAD_ENRICH_BATCH_SIZE),
  );
  const knownEmails = await LeadRepository.listEmailsForLeads(
    rows.map((lead) => lead.id),
  );
  await Promise.all(
    rows.map(({ source, ...lead }) =>
      enrichLead(
        projectId,
        lead,
        source === "shopify",
        knownEmails
          .filter((row) => row.leadId === lead.id)
          .map((row) => row.email),
      ),
    ),
  );
  return { rescanned: rows.length };
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

async function getSearchDetail(
  projectId: string,
  organizationId: string,
  searchId: string,
) {
  const search = await requireSearch(projectId, searchId);
  const [leadRows, emailRows, pool, areaRows] = await Promise.all([
    LeadRepository.listLeads(projectId, searchId),
    LeadRepository.listEmailsForSearch(projectId, searchId),
    LeadRepository.poolCounts(projectId, searchId),
    search.scope === "country" && search.source === "local"
      ? LeadRepository.listAreas(searchId)
      : Promise.resolve([]),
  ]);
  const primaryByLead = new Map(
    emailRows
      .filter((row) => row.isPrimary)
      .map((row) => [row.leadId, row.email]),
  );
  const [findingRows, prior] = await Promise.all([
    LeadListRepository.listFindings(leadRows.map((lead) => lead.id)),
    ContactRegistryService.priorContacts(
      organizationId,
      projectId,
      leadRows.map((lead) => ({
        ...lead,
        primaryEmail: primaryByLead.get(lead.id) ?? null,
      })),
    ),
  ]);

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
      ...findingsForLead(findingRows, lead.id),
      language: leadEmailLanguage({
        countryCode: lead.countryCode,
        domain: lead.domain,
        locationLabel: search.locationLabel,
      }),
      primaryEmail,
      emails: emails.map(({ email, checkStatus, kind, onOwnDomain }) => ({
        email,
        checkStatus,
        kind,
        onOwnDomain,
      })),
      reachability,
      priorContact: prior.get(lead.id) ?? null,
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
      preset: search.preset,
      scope: search.scope,
    },
    pool: { ...pool, target: search.runSize },
    areas: areaProgress(search.countryCode, areaRows),
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
  await LeadRepository.archiveSearch(projectId, searchId);
}

async function requireSearch(projectId: string, searchId: string) {
  const search = await LeadRepository.getSearch(projectId, searchId);
  if (!search) throw new AppError("NOT_FOUND");
  return search;
}

function areaProgress(
  countryCode: string | null,
  rows: Awaited<ReturnType<typeof LeadRepository.listAreas>>,
) {
  const areas = leadAreasFor(countryCode);
  if (rows.length === 0 && areas.length === 0) return null;
  const exhausted = new Set(
    rows.filter((row) => row.exhaustedAt).map((row) => row.areaCode),
  );
  const started = new Set(rows.map((row) => row.areaCode));
  const next = areas.find((area) => !exhausted.has(area.code));
  return {
    total: areas.length,
    done: exhausted.size,
    started: started.size,
    next: next?.name ?? null,
  };
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
  rescanLeads,
};
