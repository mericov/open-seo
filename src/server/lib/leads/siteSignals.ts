import type { ParsedPage } from "@/server/lib/leads/pageParser";
import { hasType, nodeTypes } from "@/server/lib/leads/jsonLd";
import type { LeadFinding } from "@/shared/leadFindings";

const HEAVY_PAGE_CHARS = 600_000;
const THIN_CONTENT_WORDS = 120;
const MANY_SCRIPT_HOSTS = 15;

const META_DESCRIPTION_PATTERN =
  /<meta\b(?=[^>]*\bname\s*=\s*["']description["'])(?=[^>]*\bcontent\s*=\s*["'][^"']{10,})[^>]*>/i;
const VIEWPORT_PATTERN = /<meta\b[^>]*\bname\s*=\s*["']viewport["']/i;
const SCHEMA_PATTERN =
  /application\/ld\+json|itemscope\b[^>]*itemtype\s*=\s*["']https?:\/\/schema\.org/i;
const BLOG_PATH_PATTERN =
  /\/(blogs?|news|haberler|yazilar|blog-yazilari|journal|articles|makaleler)(\/|$|\?|#)/i;
const DEFAULT_TITLES = new Set([
  "home",
  "homepage",
  "home page",
  "ana sayfa",
  "anasayfa",
  "welcome",
  "untitled",
  "my store",
  "my site",
  "my website",
  "index",
  "new page",
  "shop",
  "just another wordpress site",
]);
const ORG_TYPES = [
  "Organization",
  "Corporation",
  "LocalBusiness",
  "Store",
  "OnlineStore",
  "OnlineBusiness",
  "Brand",
] as const;
const FAQ_PATTERN =
  /\b(faq|faqs|frequently asked|sss|sık sorulan|sıkça sorulan|sikca-sorulan|sik-sorulan)\b/i;
const COPYRIGHT_PATTERN =
  /(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?((?:19|20)\d{2})/gi;
const ABOUT_PATTERN =
  /about|hakkimizda|hakkımızda|our-story|our story|hikayemiz|biz kimiz|who-we-are|uber-uns|qui-sommes/i;
const PRIVACY_PATTERN =
  /privacy|gizlilik|datenschutz|confidentialit|privacidad|\/policies\/privacy/i;
const REFUND_PATTERN =
  /refund|return|iade|cayma|exchange|degisim|değişim|rückgabe|widerruf|\/policies\/refund/i;
const KVKK_PATTERN =
  /kvkk|kişisel veri|kisisel-veri|kisisel veri|aydınlatma metni|aydinlatma/i;
const SOCIAL_PATTERN =
  /(instagram|facebook|tiktok|youtube|linkedin|pinterest|twitter|x)\.com\//i;
const LOCALE_LINK_PATTERN =
  /^(?:https?:\/\/[^/]+)?\/(en|tr|de|fr|es|it|nl|ar|ru|pt)(?:-[a-z]{2})?\/?(?:[?#].*)?$/i;

export function blogUrlFrom(page: ParsedPage, baseUrl: string): string | null {
  const base = new URL(baseUrl);
  for (const anchor of page.anchors) {
    const url = URL.parse(anchor.href, base);
    if (!url || url.origin !== base.origin) continue;
    if (BLOG_PATH_PATTERN.test(url.pathname)) {
      url.hash = "";
      return url.toString();
    }
  }
  return null;
}

type PageInput = {
  html: string;
  finalUrl: string;
  page: ParsedPage;
  nodes: Record<string, unknown>[];
  store: boolean;
  market: { eu: boolean; tr: boolean };
};

export function detectPageFindings(input: PageInput): LeadFinding[] {
  const { html, page } = input;
  const findings: LeadFinding[] = [];
  const add = (code: LeadFinding["code"], detail?: string | null) =>
    findings.push({ code, detail: detail ?? null });

  if (page.noindex) add("noindex_home");
  if (new URL(input.finalUrl).protocol !== "https:") add("no_https");
  if (!VIEWPORT_PATTERN.test(html)) add("not_mobile_friendly");

  const title = page.title ?? "";
  const firstSegment =
    title
      .split(/\s[|–—-]\s/)[0]
      ?.trim()
      .toLowerCase() ?? "";
  if (
    !title ||
    DEFAULT_TITLES.has(firstSegment) ||
    title.length < 15 ||
    title.length > 70
  ) {
    add("weak_title", title.slice(0, 80) || null);
  }
  if (!META_DESCRIPTION_PATTERN.test(html)) add("no_meta_description");
  if (page.h1Count !== 1) add("h1_issue", String(page.h1Count));
  if (!page.hasCanonical) add("no_canonical");
  if (page.images >= 5 && page.imagesWithoutAlt / page.images >= 0.3) {
    add(
      "missing_alt",
      `${Math.round((page.imagesWithoutAlt / page.images) * 100)}%`,
    );
  }
  if (!page.hasOpenGraph) add("no_open_graph");
  if (!page.lang) add("no_lang");
  if (page.wordCount < THIN_CONTENT_WORDS) {
    add("thin_content", String(page.wordCount));
  }
  if (
    page.hreflangCount === 0 &&
    page.anchors.some((anchor) => LOCALE_LINK_PATTERN.test(anchor.href))
  ) {
    add("no_hreflang");
  }
  if (html.length > HEAVY_PAGE_CHARS) add("heavy_page");
  if (
    page.images >= 8 &&
    page.lazyImages === 0 &&
    page.responsiveImages === 0
  ) {
    add("unoptimized_images");
  }
  const pageHost = new URL(input.finalUrl).host;
  const thirdPartyHosts = [...page.scriptHosts].filter(
    (host) => host !== pageHost,
  );
  if (thirdPartyHosts.length >= MANY_SCRIPT_HOSTS) {
    add("too_many_scripts", String(thirdPartyHosts.length));
  }

  return [...findings, ...detectGeoAndTrust(input)];
}

function detectGeoAndTrust(input: PageInput): LeadFinding[] {
  const { html, page, nodes } = input;
  const findings: LeadFinding[] = [];
  const add = (code: LeadFinding["code"], detail?: string | null) =>
    findings.push({ code, detail: detail ?? null });
  const links = page.anchors.map((anchor) => `${anchor.href} ${anchor.text}`);
  const anyLink = (pattern: RegExp) => links.some((link) => pattern.test(link));

  if (!SCHEMA_PATTERN.test(html)) add("no_schema");
  const hasOrg =
    hasType(nodes, ORG_TYPES) ||
    nodes.some((node) => "address" in node && "telephone" in node);
  if (!hasOrg) add("no_org_schema");
  if (!hasType(nodes, ["FAQPage"]) && !anyLink(FAQ_PATTERN)) add("no_faq");
  if (
    !nodes.some(
      (node) =>
        "aggregateRating" in node ||
        nodeTypes(node).includes("AggregateRating"),
    )
  ) {
    add("no_review_schema");
  }

  if (!blogUrlFrom(page, input.finalUrl)) add("no_blog");

  const years = [...html.matchAll(COPYRIGHT_PATTERN)].map((match) =>
    Number(match[1]),
  );
  const latestYear = years.length ? Math.max(...years) : null;
  if (latestYear && latestYear <= new Date().getFullYear() - 2) {
    add("old_copyright", String(latestYear));
  }
  if (!page.hasFavicon) add("no_favicon");

  const socialSameAs = nodes.some((node) =>
    SOCIAL_PATTERN.test(JSON.stringify(node.sameAs ?? "")),
  );
  if (!anyLink(SOCIAL_PATTERN) && !socialSameAs) add("no_social_links");
  if (!anyLink(ABOUT_PATTERN)) add("no_about_page");
  if (!anyLink(PRIVACY_PATTERN)) add("no_privacy_policy");
  if (input.store && !anyLink(REFUND_PATTERN)) add("no_refund_policy");
  if (input.market.tr && !KVKK_PATTERN.test(html)) add("no_kvkk");
  return findings;
}
