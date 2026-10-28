import { uniqueBy } from "remeda";
import { dohQuery, lookupMx } from "@/server/lib/leads/emailChecks";
import { jsonLdNodes } from "@/server/lib/leads/jsonLd";
import {
  detectMarketingFindings,
  detectPlatform,
} from "@/server/lib/leads/marketingSignals";
import type { ParsedPage } from "@/server/lib/leads/pageParser";
import { fetchBody, fetchText } from "@/server/lib/leads/siteFetch";
import {
  blogUrlFrom,
  detectPageFindings,
} from "@/server/lib/leads/siteSignals";
import {
  detectCatalogFindings,
  detectProductPageFindings,
  productUrlFrom,
  readCatalog,
} from "@/server/lib/leads/storeSignals";
import type { LeadFinding } from "@/shared/leadFindings";
import { categoryGroupOf } from "@/shared/leadScan";

const STALE_BLOG_DAYS = 180;

const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
];

const EU_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "GB",
  "UK",
  "NO",
  "IS",
  "LI",
  "CH",
]);

const DATE_PATTERN =
  /(?:datetime|datePublished|article:published_time|pubdate|published_at|dateCreated)\\?["'\s:=]+(?:content=)?\\?["']?(\d{4}-\d{2}-\d{2})/gi;

type SiteContext = {
  store: boolean;
  category: string | null;
  countryCode: string | null;
};

function blockedAiBots(robotsTxt: string | null): string[] {
  if (!robotsTxt) return [];
  const groups: { agents: string[]; blocksRoot: boolean }[] = [];
  let current: { agents: string[]; blocksRoot: boolean } | null = null;
  let lastWasAgent = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], blocksRoot: false };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (current && key === "disallow" && value === "/") {
      current.blocksRoot = true;
    }
  }
  return AI_BOTS.filter((bot) =>
    groups.some(
      (group) => group.blocksRoot && group.agents.includes(bot.toLowerCase()),
    ),
  );
}

function marketOf(
  host: string,
  countryCode: string | null,
  lang: string | null,
) {
  const tld = host.split(".").pop()?.toUpperCase() ?? "";
  const country = countryCode?.toUpperCase() ?? null;
  return {
    eu:
      (country !== null && EU_COUNTRIES.has(country)) || EU_COUNTRIES.has(tld),
    tr: country === "TR" || tld === "TR" || Boolean(lang?.startsWith("tr")),
  };
}

function blogDates(html: string) {
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 90 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const dates = [...html.matchAll(DATE_PATTERN)]
    .map((match) => match[1])
    .filter((date) => date <= today && date >= "2000-01-01");
  return {
    latest: dates.length
      ? dates.reduce((latest, date) => (date > latest ? date : latest))
      : null,
    recent: new Set(dates.filter((date) => date >= since)).size,
  };
}

async function hasSitemap(origin: string, listed: boolean) {
  if (listed) return true;
  const response = await fetchText(`${origin}/sitemap.xml`);
  if (!response) return null;
  return (
    response.status === 200 && /<(urlset|sitemapindex)\b/i.test(response.body)
  );
}

function sitemapLocs(xml: string) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((match) =>
    match[1].replace(/&amp;/g, "&"),
  );
}

async function sitemapPaths(origin: string, kind: string) {
  const root = await fetchText(`${origin}/sitemap.xml`);
  if (!root || root.status !== 200) return [];
  const children = sitemapLocs(root.body).filter((loc) => loc.includes(kind));
  const bodies = await Promise.all(
    children.slice(0, 2).map((loc) => fetchText(loc)),
  );
  return bodies
    .flatMap((child) => (child?.status === 200 ? sitemapLocs(child.body) : []))
    .map((loc) => URL.parse(loc)?.pathname.toLowerCase() ?? "");
}

async function hasLlmsTxt(origin: string) {
  const response = await fetchText(`${origin}/llms.txt`);
  if (!response) return null;
  return response.status === 200 && !/^\s*</.test(response.body);
}

async function redirectsToHttps(url: URL) {
  if (url.protocol !== "https:") return null;
  const response = await fetchText(`http://${url.host}/`);
  if (!response) return null;
  if (response.status >= 300 && response.status < 400) {
    const target = response.location
      ? URL.parse(response.location, `http://${url.host}/`)
      : null;
    return target?.protocol === "https:";
  }
  return response.status >= 400 ? null : false;
}

async function mailRecords(host: string) {
  const domain = host.replace(/^www\./, "");
  if (!(await lookupMx(domain))) return null;
  const [txt, dmarc] = await Promise.all([
    dohQuery(domain, "TXT"),
    dohQuery(`_dmarc.${domain}`, "TXT"),
  ]);
  if (!txt || !dmarc) return null;
  return {
    spf: txt.answers.some((answer) => /v=spf1/i.test(answer.data)),
    dmarc: dmarc.answers.some((answer) => /v=DMARC1/i.test(answer.data)),
  };
}

export async function auditSite(input: {
  home: { body: string; finalUrl: string };
  page: ParsedPage;
  robotsTxt: string | null;
  robots: { isAllowed: (url: string) => boolean; sitemapUrls: string[] };
  fetchJson: (path: string) => Promise<unknown>;
  context: SiteContext;
}): Promise<LeadFinding[]> {
  const { home, page, robots } = input;
  const url = new URL(home.finalUrl);
  const platform = detectPlatform(home.body);
  const store = input.context.store || platform !== null;
  const market = marketOf(url.hostname, input.context.countryCode, page.lang);
  const allowed = (target: string | null) =>
    target !== null && robots.isAllowed(target) ? target : null;

  const catalog = store
    ? await readCatalog(platform, url.origin, input.fetchJson)
    : [];
  const blogUrl = allowed(blogUrlFrom(page, home.finalUrl));
  const productUrl = store
    ? allowed(productUrlFrom(catalog, page, home.finalUrl))
    : null;

  const [sitemap, llms, https, blog, product, mail, blogPaths, pagePaths] =
    await Promise.all([
      hasSitemap(url.origin, robots.sitemapUrls.length > 0),
      hasLlmsTxt(url.origin),
      redirectsToHttps(url),
      blogUrl ? fetchBody(blogUrl, "html") : null,
      productUrl ? fetchBody(productUrl, "html") : null,
      mailRecords(url.hostname),
      blogUrl ? [] : sitemapPaths(url.origin, "blogs"),
      sitemapPaths(url.origin, "pages"),
    ]);
  const hasArticles = blogPaths.some((path) =>
    /\/blogs\/[^/]+\/[^/]+/.test(path),
  );
  const hasAboutPage = pagePaths.some((path) =>
    /about|hakkimizda|hakkimda|our-story|hikayemiz|who-we-are|biz-kimiz|\/author\//.test(
      path,
    ),
  );

  const findings: LeadFinding[] = [
    ...detectPageFindings({
      html: home.body,
      finalUrl: home.finalUrl,
      page,
      nodes: jsonLdNodes(home.body),
      store,
      market,
    }),
    ...detectMarketingFindings({
      html: home.body,
      extraHtml: product?.body ?? "",
      finalUrl: home.finalUrl,
      page,
      platform,
      store,
      categoryGroup: input.context.category
        ? categoryGroupOf(input.context.category)
        : null,
      market,
    }),
    ...detectCatalogFindings(catalog),
    ...(product ? detectProductPageFindings(product.body) : []),
  ];

  const bots = blockedAiBots(input.robotsTxt);
  if (bots.length)
    findings.push({ code: "ai_bots_blocked", detail: bots.join(", ") });
  if (sitemap === false) findings.push({ code: "no_sitemap" });
  if (llms === false) findings.push({ code: "no_llms_txt" });
  if (https === false) findings.push({ code: "http_not_redirected" });
  const posts = blog ? blogDates(blog.body) : null;
  if (posts?.latest) {
    if (Date.now() - Date.parse(posts.latest) > STALE_BLOG_DAYS * 86_400_000) {
      findings.push({ code: "stale_blog", detail: posts.latest });
    } else if (posts.recent < 2) {
      findings.push({ code: "irregular_blog", detail: String(posts.recent) });
    }
  }
  if (mail && !mail.spf) findings.push({ code: "no_spf" });
  if (mail && !mail.dmarc) findings.push({ code: "no_dmarc" });

  const reviewedProduct = product && /aggregateRating/i.test(product.body);
  return uniqueBy(
    findings.filter(
      (finding) =>
        !(reviewedProduct && finding.code === "no_review_schema") &&
        !(hasArticles && finding.code === "no_blog") &&
        !(hasAboutPage && finding.code === "no_about_page"),
    ),
    (finding) => finding.code,
  );
}
