import type { BillingCustomerContext } from "@/server/billing/subscription";
import { LeadRepository } from "@/server/features/leads/repositories/LeadRepository";
import {
  fetchStoreRows,
  normalizeDomain,
  saveStoreRows,
  type SaveTarget,
  type StoreRow,
} from "@/server/features/leads/services/leadSources";
import type { LeadStorePlatform } from "@/shared/leadScan";

export const STORE_IMPORT_MAX_DOMAINS = 200;

const searchDefaults = {
  source: "shopify" as const,
  scope: "country" as const,
  category: "shopify",
  locationLabel: "",
  latitude: 0,
  longitude: 0,
  radiusKm: 0,
};

type StoreSearchInput = {
  projectId: string;
  technology: LeadStorePlatform;
  keywords: string[];
  countryCode?: string;
  maxRank?: number;
  limit: number;
};

async function startStoreSearch(
  input: StoreSearchInput,
  billing: BillingCustomerContext,
) {
  const { returned, rows } = await fetchStoreRows(billing, input, {
    limit: input.limit,
    offset: 0,
  });
  const keywordLabel = input.keywords.join(", ") || "all";
  const searchId = await LeadRepository.createSearch(input.projectId, {
    ...searchDefaults,
    label: `${input.technology} · ${keywordLabel}${input.countryCode ? ` · ${input.countryCode}` : ""}`,
    preset: "shopify_service",
    technology: input.technology,
    countryCode: input.countryCode ?? null,
    keywordQuery: input.keywords.join(", ") || null,
    maxRank: input.maxRank ?? null,
    requestedLimit: input.limit,
    nextOffset: returned,
  });
  return finish(
    {
      organizationId: billing.organizationId,
      projectId: input.projectId,
      searchId,
    },
    rows,
  );
}

async function importStores(
  organizationId: string,
  projectId: string,
  text: string,
) {
  const domains = [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map(normalizeDomain)
        .filter((domain): domain is string => domain != null),
    ),
  ].slice(0, STORE_IMPORT_MAX_DOMAINS);

  const searchId = await LeadRepository.createSearch(projectId, {
    ...searchDefaults,
    scope: "list",
    label: `Store list · ${domains.length} domains`,
    requestedLimit: domains.length,
  });
  return finish(
    { organizationId, projectId, searchId },
    domains.map((domain) => ({
      domain,
      name: domain,
      countryCode: null,
      domainRank: null,
      phone: null,
      emails: [],
    })),
  );
}

async function finish(target: SaveTarget, rows: StoreRow[]) {
  const { found, added } = await saveStoreRows(target, rows);
  await LeadRepository.updateSearch(target.projectId, target.searchId, {
    skippedDuplicates: found - added,
  });
  return {
    searchId: target.searchId,
    found,
    added,
    skippedDuplicates: found - added,
  };
}

export const StoreFinderService = { startStoreSearch, importStores };
