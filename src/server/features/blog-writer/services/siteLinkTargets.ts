import { sort } from "remeda";
import { discoverUrls } from "@/server/lib/audit/discovery";
import { normalizeAndValidateStartUrl } from "@/server/lib/audit/url-policy";

const DISCOVERY_PAGE_BUDGET = 100;
const MAX_PER_GROUP = 60;

type LinkTargetKind = "category" | "page" | "blog_post" | "product";

type LinkTarget = {
  url: string;
  kind: LinkTargetKind;
  label: string;
  relevance: number;
};

const CATEGORY_PATTERNS = [
  /^\/collections\/[^/]+\/?$/i,
  /^\/(product-)?categor(y|ies)\//i,
  /^\/(urun-)?kategori(ler)?\//i,
  /^\/shop\/[^/]+\/?$/i,
];
const PRODUCT_PATTERNS = [
  /\/products\/[^/]+\/?$/i,
  /^\/(product|urun)\/[^/]+/i,
];
const BLOG_PATTERNS = [
  /^\/blogs\/[^/]+\/[^/]+/i,
  /^\/(blog|articles?|news|journal|makale(ler)?|rehber)\/[^/]+/i,
];
const IGNORED_PATHS = [
  /^\/(cart|account|checkout|search|policies|tools|apps|cdn|admin)\b/i,
  /^\/collections\/(all|vendors|types)\/?$/i,
  /^\/blogs\/[^/]+\/?$/i,
];

export function classifyPath(pathname: string): LinkTargetKind | null {
  if (
    pathname === "/" ||
    IGNORED_PATHS.some((pattern) => pattern.test(pathname))
  )
    return null;
  if (CATEGORY_PATTERNS.some((pattern) => pattern.test(pathname)))
    return "category";
  if (BLOG_PATTERNS.some((pattern) => pattern.test(pathname)))
    return "blog_post";
  if (PRODUCT_PATTERNS.some((pattern) => pattern.test(pathname)))
    return "product";
  return "page";
}

export function labelFor(pathname: string) {
  const last = pathname.replace(/\/+$/, "").split("/").pop() ?? pathname;
  let decoded = last;
  try {
    decoded = decodeURIComponent(last);
  } catch {
    decoded = last;
  }
  return decoded.replace(/[-_]+/g, " ").trim() || pathname;
}

export function tokens(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 2);
}

export function relevanceFor(label: string, topicTokens: string[]) {
  if (topicTokens.length === 0) return 0;
  const labelTokens = tokens(label);
  let score = 0;
  for (const topicToken of topicTokens) {
    if (
      labelTokens.some(
        (labelToken) =>
          labelToken.startsWith(topicToken.slice(0, 5)) ||
          topicToken.startsWith(labelToken.slice(0, 5)),
      )
    )
      score += 1;
  }
  return score / topicTokens.length;
}

export function groupLinkTargets(urls: string[], topic?: string) {
  const topicTokens = topic ? tokens(topic) : [];
  const seen = new Set<string>();
  const targets: LinkTarget[] = [];
  for (const raw of urls) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      continue;
    }
    const pathname = parsed.pathname;
    const kind = classifyPath(pathname);
    if (!kind) continue;
    const url = `${parsed.origin}${pathname}`;
    if (seen.has(url)) continue;
    seen.add(url);
    const label = labelFor(pathname);
    targets.push({
      url,
      kind,
      label,
      relevance: relevanceFor(label, topicTokens),
    });
  }
  const byKind = (kind: LinkTargetKind) =>
    sort(
      targets.filter((target) => target.kind === kind),
      (a, b) => b.relevance - a.relevance || a.label.localeCompare(b.label),
    ).slice(0, MAX_PER_GROUP);
  return {
    categories: byKind("category"),
    pages: byKind("page"),
    blogPosts: byKind("blog_post"),
    products: byKind("product"),
    totalDiscovered: targets.length,
  };
}

export async function discoverLinkTargets(domain: string, topic?: string) {
  const startUrl = await normalizeAndValidateStartUrl(domain);
  const origin = new URL(startUrl).origin;
  const { urls } = await discoverUrls(origin, DISCOVERY_PAGE_BUDGET);
  return { origin, ...groupLinkTargets(urls, topic) };
}
