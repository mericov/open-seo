import { sortBy } from "remeda";

export const LEAD_FINDING_CODES = [
  "no_website",
  "unclaimed_profile",
  "few_reviews",
  "low_rating",
  "no_hours",
  "few_photos",
  "no_click_to_call",
  "no_online_booking",
  "noindex_home",
  "no_https",
  "http_not_redirected",
  "not_mobile_friendly",
  "weak_title",
  "no_meta_description",
  "h1_issue",
  "no_canonical",
  "missing_alt",
  "no_sitemap",
  "no_open_graph",
  "no_lang",
  "thin_content",
  "no_hreflang",
  "heavy_page",
  "unoptimized_images",
  "too_many_scripts",
  "ai_bots_blocked",
  "no_schema",
  "no_org_schema",
  "no_faq",
  "no_review_schema",
  "no_llms_txt",
  "no_blog",
  "stale_blog",
  "myshopify_domain",
  "vintage_theme",
  "stock_theme",
  "old_copyright",
  "powered_by_shopify",
  "no_favicon",
  "legacy_analytics",
  "no_analytics",
  "no_meta_pixel",
  "no_google_ads_tag",
  "no_tiktok_pixel",
  "no_pinterest_tag",
  "no_heatmap",
  "no_consent_banner",
  "no_email_marketing",
  "mailchimp_store",
  "no_spf",
  "no_dmarc",
  "free_email_contact",
  "no_reviews_app",
  "no_live_chat",
  "out_of_stock",
  "empty_descriptions",
  "single_image_products",
  "stale_products",
  "no_product_schema",
  "product_schema_gaps",
  "no_social_links",
  "no_about_page",
  "no_privacy_policy",
  "no_refund_policy",
  "no_kvkk",
] as const;

export type LeadFindingCode = (typeof LEAD_FINDING_CODES)[number];

export const LEAD_FINDING_CATEGORIES = [
  "local",
  "seo",
  "geo",
  "content",
  "design",
  "tracking",
  "email",
  "conversion",
  "store",
  "trust",
] as const;

type LeadFindingCategory = (typeof LEAD_FINDING_CATEGORIES)[number];

export const LEAD_FINDING_SEVERITIES = [
  "critical",
  "important",
  "low",
] as const;

export type LeadFindingSeverity = (typeof LEAD_FINDING_SEVERITIES)[number];

export type LeadFinding = { code: LeadFindingCode; detail?: string | null };

type FindingMeta = [LeadFindingCategory, LeadFindingSeverity];

export const LEAD_FINDING_META: Record<LeadFindingCode, FindingMeta> = {
  no_website: ["local", "critical"],
  unclaimed_profile: ["local", "critical"],
  few_reviews: ["local", "important"],
  low_rating: ["local", "important"],
  no_hours: ["local", "low"],
  few_photos: ["local", "low"],
  no_click_to_call: ["local", "low"],
  no_online_booking: ["local", "important"],
  noindex_home: ["seo", "critical"],
  no_https: ["seo", "critical"],
  http_not_redirected: ["seo", "important"],
  not_mobile_friendly: ["seo", "critical"],
  weak_title: ["seo", "important"],
  no_meta_description: ["seo", "important"],
  h1_issue: ["seo", "low"],
  no_canonical: ["seo", "low"],
  missing_alt: ["seo", "important"],
  no_sitemap: ["seo", "important"],
  no_open_graph: ["seo", "low"],
  no_lang: ["seo", "low"],
  thin_content: ["seo", "important"],
  no_hreflang: ["seo", "important"],
  heavy_page: ["seo", "important"],
  unoptimized_images: ["seo", "low"],
  too_many_scripts: ["seo", "important"],
  ai_bots_blocked: ["geo", "critical"],
  no_schema: ["geo", "important"],
  no_org_schema: ["geo", "important"],
  no_faq: ["geo", "low"],
  no_review_schema: ["geo", "low"],
  no_llms_txt: ["geo", "low"],
  no_blog: ["content", "important"],
  stale_blog: ["content", "important"],
  myshopify_domain: ["design", "critical"],
  vintage_theme: ["design", "important"],
  stock_theme: ["design", "important"],
  old_copyright: ["design", "low"],
  powered_by_shopify: ["design", "low"],
  no_favicon: ["design", "low"],
  legacy_analytics: ["tracking", "critical"],
  no_analytics: ["tracking", "important"],
  no_meta_pixel: ["tracking", "important"],
  no_google_ads_tag: ["tracking", "low"],
  no_tiktok_pixel: ["tracking", "low"],
  no_pinterest_tag: ["tracking", "low"],
  no_heatmap: ["tracking", "low"],
  no_consent_banner: ["tracking", "important"],
  no_email_marketing: ["email", "important"],
  mailchimp_store: ["email", "low"],
  no_spf: ["email", "important"],
  no_dmarc: ["email", "important"],
  free_email_contact: ["email", "low"],
  no_reviews_app: ["conversion", "important"],
  no_live_chat: ["conversion", "low"],
  out_of_stock: ["store", "important"],
  empty_descriptions: ["store", "important"],
  single_image_products: ["store", "low"],
  stale_products: ["store", "low"],
  no_product_schema: ["store", "critical"],
  product_schema_gaps: ["store", "important"],
  no_social_links: ["trust", "low"],
  no_about_page: ["trust", "low"],
  no_privacy_policy: ["trust", "important"],
  no_refund_policy: ["trust", "important"],
  no_kvkk: ["trust", "important"],
};

const SEVERITY_WEIGHTS: Record<LeadFindingSeverity, number> = {
  critical: 20,
  important: 8,
  low: 3,
};

export const LEAD_OUTREACH_STATUSES = [
  "new",
  "contacted",
  "replied",
  "not_interested",
  "client",
] as const;

export const LEAD_NOTE_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "gray",
] as const;

export type LeadNoteColor = (typeof LEAD_NOTE_COLORS)[number];

export type LeadOutreachStatus = (typeof LEAD_OUTREACH_STATUSES)[number];

function findingWeight(code: LeadFindingCode): number {
  return code === "no_website"
    ? 70
    : SEVERITY_WEIGHTS[LEAD_FINDING_META[code][1]];
}

export function opportunityScore(findings: readonly LeadFindingCode[]): number {
  const total = findings.reduce((sum, code) => sum + findingWeight(code), 0);
  return Math.min(100, total);
}

function sortFindingsByWeight(
  findings: readonly LeadFindingCode[],
): LeadFindingCode[] {
  return sortBy(
    LEAD_FINDING_CODES.filter((code) => findings.includes(code)),
    (code) => -findingWeight(code),
  );
}

export function findingsForLead(
  rows: readonly {
    leadId: string;
    code: LeadFindingCode;
    detail: string | null;
  }[],
  leadId: string,
): {
  findings: LeadFindingCode[];
  findingDetails: Partial<Record<LeadFindingCode, string>>;
} {
  const own = rows.filter((row) => row.leadId === leadId);
  const findingDetails: Partial<Record<LeadFindingCode, string>> = {};
  for (const row of own) if (row.detail) findingDetails[row.code] = row.detail;
  return {
    findings: sortFindingsByWeight(own.map((row) => row.code)),
    findingDetails,
  };
}
