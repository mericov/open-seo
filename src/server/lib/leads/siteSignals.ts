import type { LeadFindingCode } from "@/shared/leadFindings";

const HEAVY_PAGE_CHARS = 600_000;

const ANALYTICS_PATTERN =
  /googletagmanager\.com\/(gtag\/js|gtm\.js)|google-analytics\.com\/(analytics|ga)\.js|["']G-[A-Z0-9]{6,}["']|["']GTM-[A-Z0-9]{4,}["']/i;
const META_PIXEL_PATTERN =
  /connect\.facebook\.net\/[^"']*\/fbevents\.js|fbq\(\s*["']init|facebook-pixel|"pixel_?id"\s*:\s*"\d{6,}"/i;
const META_DESCRIPTION_PATTERN =
  /<meta\b(?=[^>]*\bname\s*=\s*["']description["'])(?=[^>]*\bcontent\s*=\s*["'][^"']{10,})[^>]*>/i;
const VIEWPORT_PATTERN = /<meta\b[^>]*\bname\s*=\s*["']viewport["']/i;
const SCHEMA_PATTERN =
  /application\/ld\+json|itemscope\b[^>]*itemtype\s*=\s*["']https?:\/\/schema\.org/i;
const BLOG_LINK_PATTERN =
  /<a\b[^>]*\bhref\s*=\s*["'][^"']*\/(blogs?|news|haberler|yazilar|journal)(\/|["'?#])/i;

export function detectSiteFindings(
  html: string,
  finalUrl: string,
): LeadFindingCode[] {
  const findings: LeadFindingCode[] = [];
  if (new URL(finalUrl).protocol !== "https:") findings.push("no_https");
  if (!VIEWPORT_PATTERN.test(html)) findings.push("not_mobile_friendly");
  if (!ANALYTICS_PATTERN.test(html)) findings.push("no_analytics");
  if (!META_PIXEL_PATTERN.test(html)) findings.push("no_meta_pixel");
  if (!META_DESCRIPTION_PATTERN.test(html)) {
    findings.push("no_meta_description");
  }
  if (!SCHEMA_PATTERN.test(html)) findings.push("no_schema");
  if (!BLOG_LINK_PATTERN.test(html)) findings.push("no_blog");
  if (html.length > HEAVY_PAGE_CHARS) findings.push("heavy_page");
  return findings;
}
