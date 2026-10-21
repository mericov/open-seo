import { Parser } from "htmlparser2";
import { parseRobotsTxt } from "@/server/lib/audit/discovery";
import {
  isCrawlableUrl,
  normalizeAndValidateStartUrl,
} from "@/server/lib/audit/url-policy";
import {
  readShopifyStats,
  type ShopifyStats,
} from "@/server/lib/leads/shopifyStore";
import { detectSiteFindings } from "@/server/lib/leads/siteSignals";
import { socialProfiles } from "@/server/lib/leads/socialLinks";
import type { LeadFindingCode } from "@/shared/leadFindings";

// Reads a business website for the contact details it publishes: emails,
// social profiles and a WhatsApp link. It visits the home page and, only when
// the home page shows no email on the site's own domain, up to two contact
// pages. Every URL is SSRF-screened and redirects are followed by hand.

const USER_AGENT = "MericSEO-LeadFinder/1.0 (+https://seo.mericozyon.com)";
const PAGE_TIMEOUT_MS = 8_000;
const MAX_REDIRECT_HOPS = 6;
const MAX_HTML_CHARS = 1_500_000;
const MAX_CONTACT_PAGES = 3;

const CONTACT_LINK_PATTERN =
  /contact|iletisim|iletişim|bize-?ulas|bize ulaş|kontakt|impressum/i;
const ABOUT_LINK_PATTERN = /about|hakkimizda|hakkımızda/i;

const EMAIL_PATTERN = /[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,24}/gi;
const OBFUSCATED_EMAIL_PATTERN =
  /([a-z0-9._%+-]{1,64})\s*[[(]\s*(?:at|@)\s*[\])]\s*([a-z0-9-]{1,63}(?:\s*[[(]\s*(?:dot|\.)\s*[\])]\s*[a-z0-9-]{1,63})+)/gi;

const JUNK_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.org",
  "domain.com",
  "yourdomain.com",
  "email.com",
  "mysite.com",
  "company.com",
  "test.com",
  "sentry.io",
  "wixpress.com",
  "sentry.wixpress.com",
  "sentry-next.wixpress.com",
]);
const JUNK_LOCAL_PARTS = new Set([
  "your",
  "yourname",
  "name",
  "email",
  "user",
  "username",
  "example",
  "test",
  "johndoe",
  "john.doe",
  "noreply",
  "no-reply",
  "donotreply",
]);
const ASSET_EXTENSION = /\.(png|jpe?g|gif|svg|webp|avif|css|js|ico)$/i;

type SiteContacts = {
  status: "done" | "failed";
  emails: string[];
  contactPageUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  whatsappUrl: string | null;
  shopify: ShopifyStats | null;
  findings: LeadFindingCode[];
};

type FindOptions = { shopify?: boolean };

const SHOPIFY_CONTACT_PATHS = [
  "/pages/contact",
  "/pages/contact-us",
  "/pages/iletisim",
];

type ParsedPage = {
  lang: string | null;
  anchors: { href: string; text: string }[];
  emails: Set<string>;
};

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
  const robots = parseRobotsTxt(origin, await fetchRobots(origin));
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

  const shopify = options.shopify
    ? await readShopifyStats(async (path) => {
        const url = new URL(path, origin).toString();
        if (!robots.isAllowed(url)) return null;
        const json = await fetchBody(url, "json");
        if (!json) return null;
        try {
          return JSON.parse(json.body) as unknown;
        } catch {
          return null;
        }
      })
    : null;

  return {
    status: "done",
    emails: [...new Set(pages.flatMap((page) => [...page.emails]))],
    contactPageUrl,
    ...socialProfiles(pages.flatMap((page) => page.anchors)),
    shopify,
    findings: detectSiteFindings(home.body, home.finalUrl),
  };
}

async function fetchBody(
  url: string,
  type: "html" | "json",
): Promise<{ body: string; finalUrl: string } | null> {
  let current = url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
      const response = await fetch(current, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: type === "html" ? "text/html" : "application/json",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) return null;
        current = await normalizeAndValidateStartUrl(
          new URL(location, current).toString(),
        );
        continue;
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.toLowerCase().includes(type)) {
        await response.body?.cancel();
        return null;
      }
      const body = (await response.text()).slice(0, MAX_HTML_CHARS);
      return { body, finalUrl: current };
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchRobots(origin: string): Promise<string | null> {
  try {
    const response = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "manual",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    return (await response.text()).slice(0, 200_000);
  } catch {
    return null;
  }
}

function parseHtml(html: string): ParsedPage {
  const page: ParsedPage = { lang: null, anchors: [], emails: new Set() };
  let openAnchor: { href: string; text: string } | null = null;
  const textChunks: string[] = [];

  const parser = new Parser(
    {
      onopentag(name, attrs) {
        if (name === "html" && attrs.lang) page.lang = attrs.lang.toLowerCase();
        if (attrs["data-cfemail"]) {
          addEmail(page.emails, decodeCloudflareEmail(attrs["data-cfemail"]));
        }
        if (name === "a" && attrs.href) {
          const href = attrs.href.trim();
          if (href.toLowerCase().startsWith("mailto:")) {
            addEmail(page.emails, mailtoAddress(href));
          }
          openAnchor = { href, text: "" };
        }
      },
      ontext(text) {
        textChunks.push(text);
        if (openAnchor) openAnchor.text += text;
      },
      onclosetag(name) {
        if (name === "a" && openAnchor) {
          page.anchors.push(openAnchor);
          openAnchor = null;
        }
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();

  const text = textChunks.join(" ");
  for (const match of text.matchAll(EMAIL_PATTERN)) {
    addEmail(page.emails, match[0]);
  }
  for (const match of text.matchAll(OBFUSCATED_EMAIL_PATTERN)) {
    const domain = match[2].replace(/\s*[[(]\s*(?:dot|\.)\s*[\])]\s*/gi, ".");
    addEmail(page.emails, `${match[1]}@${domain}`);
  }
  return page;
}

function addEmail(set: Set<string>, raw: string | null) {
  if (!raw) return;
  const email = raw
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[.]+$/g, "");
  if (isPlausibleEmail(email)) set.add(email);
}

function isPlausibleEmail(email: string): boolean {
  const [local, domain] = email.split("@");
  if (!local || !domain || email.split("@").length !== 2) return false;
  if (
    !/^[a-z0-9._%+-]+$/.test(local) ||
    !/^[a-z0-9.-]+\.[a-z]{2,24}$/.test(domain)
  ) {
    return false;
  }
  if (ASSET_EXTENSION.test(email)) return false;
  if (JUNK_EMAIL_DOMAINS.has(domain) || JUNK_LOCAL_PARTS.has(local))
    return false;
  // Hash-like local parts are tracking ids (e.g. Sentry DSNs), not inboxes.
  if (/^[a-f0-9]{20,}$/.test(local)) return false;
  return true;
}

function mailtoAddress(href: string): string | null {
  try {
    const value = decodeURIComponent(href.slice("mailto:".length));
    return value.split("?")[0].split(",")[0];
  } catch {
    return null;
  }
}

function decodeCloudflareEmail(encoded: string): string | null {
  if (!/^[0-9a-f]+$/i.test(encoded) || encoded.length < 4) return null;
  const key = Number.parseInt(encoded.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < encoded.length; i += 2) {
    out += String.fromCharCode(
      Number.parseInt(encoded.slice(i, i + 2), 16) ^ key,
    );
  }
  return out;
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
