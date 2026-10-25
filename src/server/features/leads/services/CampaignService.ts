import { sortBy } from "remeda";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { AppError } from "@/server/lib/errors";
import { LeadListRepository } from "@/server/features/leads/repositories/LeadListRepository";
import { CampaignRepository } from "@/server/features/leads/repositories/CampaignRepository";
import { LeadRepository } from "@/server/features/leads/repositories/LeadRepository";
import { ContactRegistryService } from "@/server/features/leads/services/ContactRegistryService";
import { LeadScanService } from "@/server/features/leads/services/LeadScanService";
import { areaProgress } from "@/shared/leadAreas";
import { leadEmailLanguage } from "@/shared/leadEmail";
import { findingsForLead } from "@/shared/leadFindings";
import {
  LEAD_REACHABILITY_ORDER,
  leadReachability,
  type LeadReachability,
} from "@/shared/leads";
import type { CreateLeadCampaignInput } from "@/types/schemas/leads";

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  TR: "Türkiye",
};

const PRESET_LABELS = {
  product_b2b: "B2B buyers",
  local_service: "Local businesses",
  shopify_service: "Online stores",
} as const;

type LocalArea = Extract<
  CreateLeadCampaignInput,
  { preset: "product_b2b" }
>["area"];

function areaFields(area: LocalArea) {
  if (area.scope === "country") {
    return {
      scope: "country" as const,
      countryCode: area.countryCode,
      locationLabel: COUNTRY_NAMES[area.countryCode] ?? area.countryCode,
      latitude: 0,
      longitude: 0,
      radiusKm: 0,
    };
  }
  return {
    scope: "place" as const,
    countryCode: null,
    locationLabel: area.place.label,
    latitude: area.place.latitude,
    longitude: area.place.longitude,
    radiusKm: area.radiusKm,
  };
}

function shortPlace(label: string) {
  return label.split(",")[0]?.trim() || label;
}

function humanize(value: string) {
  const words = value.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function searchValues(input: CreateLeadCampaignInput) {
  const pool = {
    preset: input.preset,
    runSize: input.weeklyTarget,
    requestedLimit: input.weeklyTarget,
    autoRun: input.autoRun,
  };
  if (input.preset === "shopify_service") {
    const keywords = input.keywords.join(", ");
    return {
      ...pool,
      source: "shopify" as const,
      scope: "country" as const,
      label: [`${input.technology} stores`, input.countryCode, keywords || null]
        .filter(Boolean)
        .join(" · "),
      category: "shopify",
      technology: input.technology,
      countryCode: input.countryCode,
      keywordQuery: keywords || null,
      maxRank: input.maxRank ?? null,
      locationLabel: "",
      latitude: 0,
      longitude: 0,
      radiusKm: 0,
    };
  }
  const area = areaFields(input.area);
  const group =
    input.preset === "product_b2b" ? "product_b2b" : input.categoryGroup;
  const what =
    input.preset === "product_b2b"
      ? PRESET_LABELS.product_b2b
      : group === "all"
        ? PRESET_LABELS.local_service
        : humanize(group);
  const needFilter =
    input.preset === "local_service" ? (input.needFilter ?? null) : null;
  return {
    ...pool,
    ...area,
    source: "local" as const,
    label: [
      what,
      needFilter ? humanize(needFilter) : null,
      shortPlace(area.locationLabel),
    ]
      .filter(Boolean)
      .join(" · "),
    category: group,
    categoryGroup: group,
    needFilter,
  };
}

async function create(
  input: CreateLeadCampaignInput,
  billing: BillingCustomerContext,
) {
  const searchId = await LeadRepository.createSearch(
    input.projectId,
    searchValues(input),
  );
  const search = await LeadRepository.getSearch(input.projectId, searchId);
  if (!search) throw new AppError("NOT_FOUND");
  const result = await LeadScanService.fillPool(search, billing);
  return { searchId, ...result };
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
  const search = await LeadRepository.getSearch(projectId, searchId);
  if (!search) throw new AppError("NOT_FOUND");
  const [leadRows, emailRows, pool, areaRows] = await Promise.all([
    LeadRepository.listLeads(projectId, searchId),
    LeadRepository.listEmailsForSearch(projectId, searchId),
    LeadRepository.poolCounts(projectId, searchId),
    search.scope === "country" && search.source === "local"
      ? CampaignRepository.listAreas(searchId)
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

export const CampaignService = { create, listSearches, getSearchDetail };
