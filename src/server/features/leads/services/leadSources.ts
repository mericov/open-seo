import { z } from "zod";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { createDataforseoClient } from "@/server/lib/dataforseo";
import { isRecord } from "@/server/lib/dataforseo/envelope";
import { classifyEmail } from "@/server/lib/leads/emailChecks";
import { ContactRegistryRepository } from "@/server/features/leads/repositories/ContactRegistryRepository";
import { LeadRepository } from "@/server/features/leads/repositories/LeadRepository";
import { ownDomain } from "@/shared/leads";
import { FEW_REVIEWS_THRESHOLD, type LeadNeedFilter } from "@/shared/leadScan";

type LocalSourceParams = {
  categories?: string[];
  nameQuery?: string | null;
  latitude: number;
  longitude: number;
  radiusKm: number;
  minRating?: number | null;
  needFilter?: LeadNeedFilter | null;
};

type StoreSourceParams = {
  technology: string;
  keywords: string[];
  countryCode?: string | null;
  maxRank?: number | null;
};

type Page = { limit: number; offset: number };

export type SourcePageResult = {
  returned: number;
  found: number;
  added: number;
  linked: number;
};

export async function fetchAndSaveLocal(
  billing: BillingCustomerContext,
  target: SaveTarget,
  params: LocalSourceParams,
  page: Page,
): Promise<SourcePageResult> {
  const conditions: unknown[] = [];
  if (params.minRating != null) {
    conditions.push(["rating.value", ">=", params.minRating]);
  }
  if (params.needFilter === "no_website") conditions.push(["url", "=", null]);
  if (params.needFilter === "few_reviews") {
    conditions.push(["rating.votes_count", "<", FEW_REVIEWS_THRESHOLD]);
  }
  const client = createDataforseoClient(billing);
  const rows = await client.business.businessListings({
    categories: params.categories,
    title: params.nameQuery || undefined,
    locationCoordinate: `${formatCoordinate(params.latitude)},${formatCoordinate(params.longitude)},${params.radiusKm}`,
    isClaimed: params.needFilter === "unclaimed" ? false : undefined,
    filters: joinWithAnd(conditions),
    orderBy: ["rating.votes_count,desc"],
    limit: page.limit,
    offset: page.offset || undefined,
  });

  const listings = rows.flatMap((row) => {
    const listing = toListing(row);
    return listing ? [listing] : [];
  });
  const saved = await saveFoundLeads(target, listings);
  return { returned: rows.length, ...saved };
}

type FoundLead = {
  keys: [string, ...string[]];
  lead: Omit<LeadInsert, "id" | "businessKey">;
  emails?: string[];
};

type LeadInsert = Parameters<typeof LeadRepository.insertLeads>[2][number];

export type SaveTarget = {
  organizationId: string;
  projectId: string;
  searchId: string;
};

// Saves a page of found businesses into a campaign. A business the project
// already holds (matched on any of its keys) is linked instead of inserted, so
// a new campaign still shows it with its outreach history. Domains the
// organization asked never to contact again are dropped.
async function saveFoundLeads(target: SaveTarget, found: FoundLead[]) {
  const unique = [...new Map(found.map((row) => [row.keys[0], row])).values()];
  const [existing, registry] = await Promise.all([
    LeadRepository.findLeadIdsByKeys(
      target.projectId,
      unique.flatMap((row) => row.keys),
    ),
    ContactRegistryRepository.listByKeys(
      target.organizationId,
      unique.flatMap((row) => {
        const domain = ownDomain(row.lead.domain ?? null);
        return domain ? [domain] : [];
      }),
    ),
  ]);
  const suppressed = new Set(
    registry.filter((row) => row.suppressedAt).map((row) => row.contactKey),
  );
  const fresh: (FoundLead & { id: string })[] = [];
  const known: string[] = [];
  for (const row of unique) {
    const domain = ownDomain(row.lead.domain ?? null);
    if (domain && suppressed.has(domain)) continue;
    const knownId = row.keys
      .map((key) => existing.get(key))
      .find((id) => id != null);
    if (knownId) known.push(knownId);
    else fresh.push({ ...row, id: crypto.randomUUID() });
  }

  await LeadRepository.insertLeads(
    target.projectId,
    target.searchId,
    fresh.map((row) => ({ ...row.lead, id: row.id, businessKey: row.keys[0] })),
  );
  await LeadRepository.insertFoundEmails(
    fresh.flatMap((row) =>
      (row.emails ?? []).map((email) => ({
        leadId: row.id,
        email,
        checkStatus: "mx_ok" as const,
        ...classifyEmail(email, row.lead.domain ?? null),
        isPrimary: false,
      })),
    ),
  );
  const alreadyLinked = await LeadRepository.listLinkedLeadIds(
    target.searchId,
    known,
  );
  const newlyLinked = known.filter((id) => !alreadyLinked.has(id));
  await LeadRepository.linkLeads(target.searchId, [
    ...fresh.map((row) => row.id),
    ...newlyLinked,
  ]);
  return {
    found: unique.length,
    added: fresh.length,
    linked: newlyLinked.length,
  };
}

const technologyItemSchema = z.object({
  domain: z.string().min(1),
  title: z.string().nullish(),
  domain_rank: z.coerce.number().nullish(),
  country_iso_code: z.string().nullish(),
  phone_numbers: z.array(z.string()).nullish(),
  emails: z.array(z.string()).nullish(),
});

const EMAIL_PATTERN = /^[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,24}$/;

export type StoreRow = {
  domain: string;
  name: string;
  countryCode: string | null;
  domainRank: number | null;
  phone: string | null;
  emails: string[];
};

export async function fetchStoreRows(
  billing: BillingCustomerContext,
  params: StoreSourceParams,
  page: Page,
): Promise<{ returned: number; rows: StoreRow[] }> {
  const conditions: unknown[] = [];
  if (params.countryCode) {
    conditions.push(["country_iso_code", "=", params.countryCode]);
  }
  if (params.maxRank != null) {
    conditions.push(["domain_rank", "<=", params.maxRank]);
  }
  const client = createDataforseoClient(billing);
  const keywordSets =
    params.keywords.length > 1
      ? params.keywords.map((keyword) => [keyword])
      : [params.keywords];
  const share = Math.ceil(page.limit / keywordSets.length);
  const results = await Promise.all(
    keywordSets.map((keywords) =>
      client.domainAnalytics.domainsByTechnology({
        technologies: [params.technology],
        keywords,
        filters: joinWithAnd(conditions),
        orderBy: ["domain_rank,desc"],
        limit: share,
        offset: Math.floor(page.offset / keywordSets.length),
      }),
    ),
  );
  const items = results.flat();

  const rows = items.flatMap((item) => {
    const parsed = technologyItemSchema.safeParse(item);
    if (!parsed.success) return [];
    const domain = normalizeDomain(parsed.data.domain);
    if (!domain) return [];
    return [
      {
        domain,
        name: parsed.data.title?.replace(/\s+/g, " ").trim() || domain,
        countryCode: parsed.data.country_iso_code?.toUpperCase() ?? null,
        domainRank: parsed.data.domain_rank ?? null,
        phone: parsed.data.phone_numbers?.[0]?.trim() || null,
        emails: (parsed.data.emails ?? [])
          .map((email) => email.trim().toLowerCase())
          .filter((email) => EMAIL_PATTERN.test(email)),
      },
    ];
  });
  return { returned: items.length, rows };
}

export async function saveStoreRows(target: SaveTarget, rows: StoreRow[]) {
  return saveFoundLeads(
    target,
    rows.map((row) => ({
      keys: [storeKey(row.domain)],
      lead: {
        name: row.name,
        phone: row.phone,
        website: `https://${row.domain}/`,
        domain: row.domain,
        countryCode: row.countryCode,
        domainRank: row.domainRank,
        enrichmentStatus: "pending" as const,
      },
      emails: row.emails,
    })),
  );
}

export function normalizeDomain(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    const host = url.hostname.replace(/^www\./, "");
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

function storeKey(domain: string) {
  return `domain:${domain}`;
}

function joinWithAnd(conditions: unknown[]) {
  if (conditions.length === 0) return undefined;
  return conditions.flatMap((condition, index) =>
    index === 0 ? [condition] : ["and", condition],
  );
}

function toListing(row: Record<string, unknown>) {
  const name = stringField(row.title);
  if (!name) return null;
  const cid = stringField(row.cid);
  const placeId = stringField(row.place_id);
  const rawDomain = stringField(row.domain);
  const domain = rawDomain ? normalizeDomain(rawDomain) : null;
  const address = stringField(row.address);
  const businessDomain = ownDomain(domain);
  const [first, ...rest] = [
    businessDomain && storeKey(businessDomain),
    cid && `cid:${cid}`,
    placeId && `place:${placeId}`,
  ].filter((key): key is string => Boolean(key));
  const keys: [string, ...string[]] = [
    first ?? `name:${name.toLowerCase()}|${address?.toLowerCase() ?? ""}`,
    ...rest,
  ];
  const rating = isRecord(row.rating) ? row.rating : {};
  return {
    keys,
    lead: {
      name,
      category: stringField(row.category),
      address,
      phone: stringField(row.phone),
      website: stringField(row.url),
      domain,
      rating: numberField(rating.value),
      reviewsCount: numberField(rating.votes_count),
      isClaimed: typeof row.is_claimed === "boolean" ? row.is_claimed : null,
      photosCount: numberField(row.total_photos),
      hoursListed:
        "work_time" in row
          ? isRecord(row.work_time) &&
            isRecord(row.work_time.work_hours) &&
            isRecord(row.work_time.work_hours.timetable)
          : null,
      mapsUrl:
        stringField(row.check_url) ??
        (cid ? `https://www.google.com/maps?cid=${cid}` : null),
      enrichmentStatus: "pending" as const,
    },
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
