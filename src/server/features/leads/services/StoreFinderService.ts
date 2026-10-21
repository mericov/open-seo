import { z } from "zod";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { createDataforseoClient } from "@/server/lib/dataforseo";
import { classifyEmail } from "@/server/lib/leads/emailChecks";
import { LeadRepository } from "@/server/features/leads/repositories/LeadRepository";

export const STORE_IMPORT_MAX_DOMAINS = 200;

const EMAIL_PATTERN = /^[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,24}$/;

const technologyItemSchema = z.object({
  domain: z.string().min(1),
  title: z.string().nullish(),
  domain_rank: z.coerce.number().nullish(),
  country_iso_code: z.string().nullish(),
  phone_numbers: z.array(z.string()).nullish(),
  emails: z.array(z.string()).nullish(),
});

type StoreRow = {
  domain: string;
  name: string;
  countryCode: string | null;
  domainRank: number | null;
  phone: string | null;
  emails: string[];
};

type StoreSearchInput = {
  projectId: string;
  keywords: string[];
  countryCode?: string;
  maxRank?: number;
  limit: number;
};

async function startStoreSearch(
  input: StoreSearchInput,
  billing: BillingCustomerContext,
) {
  const conditions: unknown[] = [];
  if (input.countryCode) {
    conditions.push(["country_iso_code", "=", input.countryCode]);
  }
  if (input.maxRank != null) {
    conditions.push(["domain_rank", "<=", input.maxRank]);
  }
  const filters = conditions.flatMap((condition, index) =>
    index === 0 ? [condition] : ["and", condition],
  );

  const client = createDataforseoClient(billing);
  const items = await client.domainAnalytics.domainsByTechnology({
    technologies: ["Shopify"],
    keywords: input.keywords,
    filters,
    orderBy: ["domain_rank,desc"],
    limit: input.limit,
  });

  const rows = items.flatMap((item) => {
    const parsed = technologyItemSchema.safeParse(item);
    if (!parsed.success) return [];
    const domain = normalizeDomain(parsed.data.domain);
    if (!domain) return [];
    return [
      {
        domain,
        name: parsed.data.title?.trim() || domain,
        countryCode: parsed.data.country_iso_code?.toUpperCase() ?? null,
        domainRank: parsed.data.domain_rank ?? null,
        phone: parsed.data.phone_numbers?.[0]?.trim() || null,
        emails: (parsed.data.emails ?? [])
          .map((email) => email.trim().toLowerCase())
          .filter((email) => EMAIL_PATTERN.test(email)),
      },
    ];
  });

  const keywordLabel = input.keywords.join(", ") || "Shopify";
  return saveStores(input.projectId, rows, {
    label: `Shopify · ${keywordLabel}${input.countryCode ? ` · ${input.countryCode}` : ""}`,
    countryCode: input.countryCode ?? null,
    keywordQuery: input.keywords.join(", ") || null,
    requestedLimit: input.limit,
  });
}

async function importStores(projectId: string, text: string) {
  const domains = [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map(normalizeDomain)
        .filter((domain): domain is string => domain != null),
    ),
  ].slice(0, STORE_IMPORT_MAX_DOMAINS);

  const rows: StoreRow[] = domains.map((domain) => ({
    domain,
    name: domain,
    countryCode: null,
    domainRank: null,
    phone: null,
    emails: [],
  }));
  return saveStores(projectId, rows, {
    label: `Shopify · ${domains.length} domain`,
    countryCode: null,
    keywordQuery: null,
    requestedLimit: domains.length,
  });
}

async function saveStores(
  projectId: string,
  rows: StoreRow[],
  search: {
    label: string;
    countryCode: string | null;
    keywordQuery: string | null;
    requestedLimit: number;
  },
) {
  const unique = [...new Map(rows.map((row) => [row.domain, row])).values()];
  const existing = await LeadRepository.existingBusinessKeys(
    projectId,
    unique.map((row) => businessKey(row.domain)),
  );
  const fresh = unique
    .filter((row) => !existing.has(businessKey(row.domain)))
    .map((row) => ({ ...row, id: crypto.randomUUID() }));

  const searchId = await LeadRepository.createSearch(projectId, {
    ...search,
    source: "shopify",
    category: "shopify",
    nameQuery: null,
    locationLabel: search.countryCode ?? "",
    latitude: 0,
    longitude: 0,
    radiusKm: 0,
    skippedDuplicates: unique.length - fresh.length,
  });
  await LeadRepository.insertLeads(
    projectId,
    searchId,
    fresh.map((row) => ({
      id: row.id,
      businessKey: businessKey(row.domain),
      name: row.name,
      phone: row.phone,
      website: `https://${row.domain}/`,
      domain: row.domain,
      countryCode: row.countryCode,
      domainRank: row.domainRank,
      enrichmentStatus: "pending" as const,
    })),
  );
  await LeadRepository.insertFoundEmails(
    fresh.flatMap((row) =>
      row.emails.map((email) => ({
        leadId: row.id,
        email,
        checkStatus: "mx_ok" as const,
        ...classifyEmail(email, row.domain),
        isPrimary: false,
      })),
    ),
  );

  return {
    searchId,
    found: unique.length,
    added: fresh.length,
    skippedDuplicates: unique.length - fresh.length,
  };
}

function businessKey(domain: string) {
  return `domain:${domain}`;
}

function normalizeDomain(raw: string): string | null {
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

export const StoreFinderService = { startStoreSearch, importStores };
