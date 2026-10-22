import { parseRobotsTxt } from "@/server/lib/audit/discovery";
import { normalizeAndValidateStartUrl } from "@/server/lib/audit/url-policy";
import { emailIsOnDomain } from "@/server/lib/leads/contactExtractor";
import { classifyEmail } from "@/server/lib/leads/emailChecks";
import { asNodes, jsonLdNodes, nodeTypes } from "@/server/lib/leads/jsonLd";
import { parseHtml } from "@/server/lib/leads/pageParser";
import { fetchBody, fetchText } from "@/server/lib/leads/siteFetch";
import {
  cleanPersonName,
  emailMatchesName,
} from "@/server/lib/digital-pr/personNames";

const ARTICLE_TYPES = [
  "NewsArticle",
  "ReportageNewsArticle",
  "Article",
  "BlogPosting",
  "AnalysisNewsArticle",
  "OpinionNewsArticle",
];

type ArticleAuthorResult = {
  status: "done" | "failed";
  authorName: string | null;
  email: string | null;
};

type RobotsCache = Map<string, Promise<(url: string) => boolean>>;

export function createRobotsCache(): RobotsCache {
  return new Map();
}

function robotsFor(cache: RobotsCache, origin: string) {
  let pending = cache.get(origin);
  if (!pending) {
    pending = fetchText(`${origin}/robots.txt`).then((response) => {
      const robots = parseRobotsTxt(
        origin,
        response && response.status === 200 ? response.body : null,
      );
      return (url: string) => robots.isAllowed(url);
    });
    cache.set(origin, pending);
  }
  return pending;
}

function authorFromJsonLd(html: string): string | null {
  for (const node of jsonLdNodes(html)) {
    if (!nodeTypes(node).some((type) => ARTICLE_TYPES.includes(type))) continue;
    for (const author of asNodes(node.author)) {
      if (nodeTypes(author).includes("Organization")) continue;
      if (typeof author.name === "string") {
        const name = cleanPersonName(author.name);
        if (name) return name;
      }
    }
    if (typeof node.author === "string") {
      const name = cleanPersonName(node.author);
      if (name) return name;
    }
  }
  return null;
}

function authorFromMeta(html: string): string | null {
  const meta =
    /<meta[^>]+name=["']author["'][^>]+content=["']([^"']{3,80})["']/i.exec(
      html,
    )?.[1] ??
    /<meta[^>]+content=["']([^"']{3,80})["'][^>]+name=["']author["']/i.exec(
      html,
    )?.[1];
  return meta ? cleanPersonName(meta) : null;
}

const FAILED: ArticleAuthorResult = {
  status: "failed",
  authorName: null,
  email: null,
};

export async function readArticleAuthor(
  url: string,
  outletDomain: string,
  robotsCache: RobotsCache,
): Promise<ArticleAuthorResult> {
  let safeUrl: string;
  try {
    safeUrl = await normalizeAndValidateStartUrl(url);
  } catch {
    return FAILED;
  }
  const isAllowed = await robotsFor(robotsCache, new URL(safeUrl).origin);
  if (!isAllowed(safeUrl)) return FAILED;
  const page = await fetchBody(safeUrl, "html");
  if (!page) return FAILED;
  const authorName = authorFromJsonLd(page.body) ?? authorFromMeta(page.body);
  if (!authorName) return { status: "done", authorName: null, email: null };
  const parsed = parseHtml(page.body);
  const email =
    [...parsed.emails].find(
      (candidate) =>
        emailIsOnDomain(candidate, outletDomain) &&
        classifyEmail(candidate, outletDomain).kind === "personal" &&
        emailMatchesName(candidate, authorName),
    ) ?? null;
  return { status: "done", authorName, email };
}
