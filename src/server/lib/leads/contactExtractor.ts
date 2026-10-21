import { parseRobotsTxt } from "@/server/lib/audit/discovery";
import {
  isCrawlableUrl,
  normalizeAndValidateStartUrl,
} from "@/server/lib/audit/url-policy";
import { parseHtml, type ParsedPage } from "@/server/lib/leads/pageParser";
import {
  readShopifyStats,
  type ShopifyStats,
} from "@/server/lib/leads/shopifyStore";
import { auditSite } from "@/server/lib/leads/siteAudit";
import { fetchBody, fetchText } from "@/server/lib/leads/siteFetch";
import { socialProfiles } from "@/server/lib/leads/socialLinks";
import type { LeadFinding } from "@/shared/leadFindings";

// Reads a business website for the contact details it publishes: emails,
// social profiles and a WhatsApp link. It visits the home page and, only when
// the home page shows no email on the site's own domain, up to two contact
// pages. Every URL is SSRF-screened and redirects are followed by hand.

const MAX_CONTACT_PAGES = 3;

const CONTACT_LINK_PATTERN =
  /contact|iletisim|iletişim|bize-?ulas|bize ulaş|kontakt|impressum/i;
const ABOUT_LINK_PATTERN = /about|hakkimizda|hakkımızda/i;

type SiteContacts = {
  status: "done" | "failed";
  emails: string[];
  contactPageUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  whatsappUrl: string | null;
  shopify: ShopifyStats | null;
  findings: LeadFinding[];
};

type FindOptions = {
  shopify?: boolean;
  category?: string | null;
  countryCode?: string | null;
};

const SHOPIFY_CONTACT_PATHS = [
  "/pages/contact",
  "/pages/contact-us",
  "/pages/iletisim",
];

const EMPTY: Omit<SiteContacts, "status"> = {
  emails: [],
  contactPageUrl: null,
  instagramUrl: null,
  facebookUrl: null,
  linkedinUrl: null,
  whatsappUrl: null,
  shopify: null,
  findings: [],
};

export async function findSiteContacts(
  website: string,
  options: FindOptions = {},
): Promise<SiteContacts> {
  let start: string;
  try {
    start = await normalizeAndValidateStartUrl(website);
  } catch {
    return { status: "failed", ...EMPTY };
  }

  const home = await fetchBody(start, "html");
  if (!home) return { status: "failed", ...EMPTY };

  const origin = new URL(home.finalUrl).origin;
  const robotsResponse = await fetchText(`${origin}/robots.txt`);
  const robotsTxt =
    robotsResponse && robotsResponse.status === 200
      ? robotsResponse.body
      : null;
  const robots = parseRobotsTxt(origin, robotsTxt);
  if (!robots.isAllowed(home.finalUrl)) {
    return { status: "failed", ...EMPTY };
  }

  const pages = [parseHtml(home.body)];
  const siteDomain = registrableHost(home.finalUrl);
  let contactPageUrl: string | null = null;

  if (!hasEmailOnDomain(pages[0].emails, siteDomain)) {
    const candidates = contactPageCandidates(
      pages[0],
      home.finalUrl,
      options.shopify ? SHOPIFY_CONTACT_PATHS : [],
    );
    for (const url of candidates.slice(0, MAX_CONTACT_PAGES)) {
      if (!robots.isAllowed(url)) continue;
      const page = await fetchBody(url, "html");
      if (!page) continue;
      const parsed = parseHtml(page.body);
      pages.push(parsed);
      if (parsed.emails.size > 0 && !contactPageUrl) {
        contactPageUrl = page.finalUrl;
      }
      if (hasEmailOnDomain(parsed.emails, siteDomain)) break;
    }
  }

  const jsonCache = new Map<string, Promise<unknown>>();
  const fetchJson = (path: string) => {
    let pending = jsonCache.get(path);
    if (!pending) {
      pending = readJson(new URL(path, origin).toString(), robots.isAllowed);
      jsonCache.set(path, pending);
    }
    return pending;
  };
  const shopify = options.shopify ? await readShopifyStats(fetchJson) : null;
  const findings = await auditSite({
    home,
    page: pages[0],
    robotsTxt,
    robots,
    fetchJson,
    context: {
      store: Boolean(options.shopify),
      category: options.category ?? null,
      countryCode: shopify?.countryCode ?? options.countryCode ?? null,
    },
  });

  return {
    status: "done",
    emails: [...new Set(pages.flatMap((page) => [...page.emails]))],
    contactPageUrl,
    ...socialProfiles(pages.flatMap((page) => page.anchors)),
    shopify,
    findings,
  };
}

async function readJson(
  url: string,
  isAllowed: (url: string) => boolean,
): Promise<unknown> {
  if (!isAllowed(url)) return null;
  const json = await fetchBody(url, "json");
  if (!json) return null;
  try {
    return JSON.parse(json.body) as unknown;
  } catch {
    return null;
  }
}

function registrableHost(url: string): string {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

function hasEmailOnDomain(emails: Set<string>, siteDomain: string): boolean {
  return [...emails].some((email) => emailIsOnDomain(email, siteDomain));
}

export function emailIsOnDomain(email: string, siteDomain: string): boolean {
  const domain = email.split("@")[1] ?? "";
  return (
    domain === siteDomain ||
    domain.endsWith(`.${siteDomain}`) ||
    siteDomain.endsWith(`.${domain}`)
  );
}

function contactPageCandidates(
  page: ParsedPage,
  baseUrl: string,
  extraPaths: string[],
): string[] {
  const base = new URL(baseUrl);
  const contact: string[] = [];
  const about: string[] = [];
  for (const anchor of page.anchors) {
    const label = `${anchor.href} ${anchor.text}`;
    const bucket = CONTACT_LINK_PATTERN.test(label)
      ? contact
      : ABOUT_LINK_PATTERN.test(label)
        ? about
        : null;
    if (!bucket) continue;
    let url: URL;
    try {
      url = new URL(anchor.href, base);
    } catch {
      continue;
    }
    url.hash = "";
    const href = url.toString();
    if (url.origin !== base.origin || !isCrawlableUrl(href)) continue;
    if (href === base.toString() || contact.includes(href)) continue;
    if (!about.includes(href)) bucket.push(href);
  }
  for (const path of extraPaths) {
    const href = new URL(path, base).toString();
    if (!contact.includes(href)) contact.push(href);
  }
  if (contact.length === 0) {
    const path = page.lang?.startsWith("tr") ? "/iletisim" : "/contact";
    contact.push(new URL(path, base).toString());
  }
  return [...contact, ...about];
}
