import { sortBy } from "remeda";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { createDataforseoClient } from "@/server/lib/dataforseo";
import { getBusinessCategories } from "@/server/lib/dataforseo/businessCategories";
import { isRecord } from "@/server/lib/dataforseo/envelope";
import { AppError } from "@/server/lib/errors";
import { findSiteContacts } from "@/server/lib/leads/contactExtractor";
import { checkEmails, pickPrimaryEmail } from "@/server/lib/leads/emailChecks";
import { findPlaces } from "@/server/lib/leads/geocode";
import { LeadRepository } from "@/server/features/leads/repositories/LeadRepository";
import {
  LEAD_REACHABILITY_ORDER,
  leadReachability,
  type LeadReachability,
} from "@/shared/leads";

// Sites read per enrichment call. Each site costs several subrequests (DNS
// checks, home page, robots.txt, up to two contact pages, MX lookups), so a
// small batch keeps every call well inside the Workers subrequest budget.
export const LEAD_ENRICH_BATCH_SIZE = 3;

type StartLeadSearchInput = {
  projectId: string;
  category: string;
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
  const client = createDataforseoClient(billing);
  const rows = await client.business.businessListings({
    categories: [input.category],
    title: input.nameQuery || undefined,
    locationCoordinate: `${formatCoordinate(place.latitude)},${formatCoordinate(place.longitude)},${radiusKm}`,
    filters:
      input.minRating != null
        ? [["rating.value", ">=", input.minRating]]
        : undefined,
    orderBy: ["rating.votes_count,desc"],
    limit: input.limit,
  });

  const listings = rows.flatMap((row) => {
    const listing = toListing(row);
    return listing ? [listing] : [];
  });
  const existing = await LeadRepository.existingBusinessKeys(
    input.projectId,
    listings.map((listing) => listing.businessKey),
  );
  const fresh = listings.filter(
    (listing) => !existing.has(listing.businessKey),
  );

  const searchId = await LeadRepository.createSearch(input.projectId, {
    label: `${humanizeCategory(input.category)} · ${shortPlace(input.location)}`,
    category: input.category,
    nameQuery: input.nameQuery || null,
    locationLabel: place.label,
    latitude: place.latitude,
    longitude: place.longitude,
    radiusKm,
    requestedLimit: input.limit,
    skippedDuplicates: listings.length - fresh.length,
  });
  await LeadRepository.insertLeads(input.projectId, searchId, fresh);

  return {
    searchId,
    found: listings.length,
    added: fresh.length,
    skippedDuplicates: listings.length - fresh.length,
  };
}

async function enrichNextBatch(projectId: string, searchId: string) {
  await requireSearch(projectId, searchId);
  const pending = await LeadRepository.listPendingLeads(
    projectId,
    searchId,
    LEAD_ENRICH_BATCH_SIZE,
  );

  await Promise.all(
    pending.map(async (lead) => {
      if (!lead.website) {
        await LeadRepository.saveEnrichment(
          projectId,
          lead.id,
          { enrichmentStatus: "no_website" },
          [],
        );
        return;
      }
      const contacts = await findSiteContacts(lead.website);
      const siteDomain = lead.domain?.replace(/^www\./, "") ?? null;
      const checks = await checkEmails(contacts.emails, siteDomain);
      const primary = pickPrimaryEmail(checks);
      await LeadRepository.saveEnrichment(
        projectId,
        lead.id,
        {
          enrichmentStatus: contacts.status,
          contactPageUrl: contacts.contactPageUrl,
          instagramUrl: contacts.instagramUrl,
          facebookUrl: contacts.facebookUrl,
          linkedinUrl: contacts.linkedinUrl,
          whatsappUrl: contacts.whatsappUrl,
        },
        checks.map((check) => ({
          ...check,
          isPrimary: check.email === primary,
        })),
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
      category: search.category,
      nameQuery: search.nameQuery,
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

async function deleteSearch(projectId: string, searchId: string) {
  await requireSearch(projectId, searchId);
  await LeadRepository.deleteSearch(projectId, searchId);
}

async function requireSearch(projectId: string, searchId: string) {
  const search = await LeadRepository.getSearch(projectId, searchId);
  if (!search) throw new AppError("NOT_FOUND");
  return search;
}

function toListing(row: Record<string, unknown>) {
  const name = stringField(row.title);
  if (!name) return null;
  const cid = stringField(row.cid);
  const placeId = stringField(row.place_id);
  const domain = stringField(row.domain)?.toLowerCase() ?? null;
  const address = stringField(row.address);
  const businessKey =
    (cid && `cid:${cid}`) ||
    (placeId && `place:${placeId}`) ||
    (domain && `domain:${domain}`) ||
    `name:${name.toLowerCase()}|${address?.toLowerCase() ?? ""}`;
  const rating = isRecord(row.rating) ? row.rating : {};
  const website = stringField(row.url);
  return {
    businessKey,
    name,
    category: stringField(row.category),
    address,
    phone: stringField(row.phone),
    website,
    domain,
    rating: numberField(rating.value),
    reviewsCount: numberField(rating.votes_count),
    mapsUrl:
      stringField(row.check_url) ??
      (cid ? `https://www.google.com/maps?cid=${cid}` : null),
    enrichmentStatus: website ? ("pending" as const) : ("no_website" as const),
  };
}

function formatCoordinate(value: number): string {
  return Number(value.toFixed(6)).toString();
}

function stringField(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return null;
}

function numberField(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
};
