import { sortBy } from "remeda";

export const LEAD_FINDING_CODES = [
  "no_website",
  "no_https",
  "not_mobile_friendly",
  "no_analytics",
  "no_meta_pixel",
  "no_meta_description",
  "no_schema",
  "no_blog",
  "heavy_page",
  "few_reviews",
] as const;

export type LeadFindingCode = (typeof LEAD_FINDING_CODES)[number];

export const LEAD_OUTREACH_STATUSES = [
  "new",
  "contacted",
  "replied",
  "not_interested",
  "client",
] as const;

export type LeadOutreachStatus = (typeof LEAD_OUTREACH_STATUSES)[number];

const FINDING_WEIGHTS: Record<LeadFindingCode, number> = {
  no_website: 70,
  no_https: 15,
  not_mobile_friendly: 15,
  no_analytics: 15,
  no_meta_pixel: 10,
  no_meta_description: 10,
  no_schema: 15,
  no_blog: 10,
  heavy_page: 10,
  few_reviews: 10,
};

export function opportunityScore(findings: readonly LeadFindingCode[]): number {
  const total = findings.reduce((sum, code) => sum + FINDING_WEIGHTS[code], 0);
  return Math.min(100, total);
}

export function sortFindingsByWeight(
  findings: readonly LeadFindingCode[],
): LeadFindingCode[] {
  return sortBy(
    LEAD_FINDING_CODES.filter((code) => findings.includes(code)),
    (code) => -FINDING_WEIGHTS[code],
  );
}
