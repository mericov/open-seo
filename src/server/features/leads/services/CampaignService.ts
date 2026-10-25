import type { BillingCustomerContext } from "@/server/billing/subscription";
import { AppError } from "@/server/lib/errors";
import { LeadRepository } from "@/server/features/leads/repositories/LeadRepository";
import { LeadScanService } from "@/server/features/leads/services/LeadScanService";
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

export const CampaignService = { create };
