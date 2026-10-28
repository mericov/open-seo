import { sort } from "remeda";
import { analyzeHtml } from "@/server/lib/audit/page-analyzer";
import { firstOfType, hasType, jsonLdNodes } from "@/server/lib/leads/jsonLd";
import { tokens } from "@/server/features/blog-writer/services/siteLinkTargets";
import { normalizePageUrl } from "@/server/features/blog-tracking/services/blogTrackingReport";
import type { PageCheckId, TrackedPageKind } from "@/shared/pageTracking";

const DAY_MS = 24 * 60 * 60 * 1000;
const HEADING_PATTERN = /<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
const TAG_PATTERN = /<[^>]+>/g;
const FAQ_HEADING = /\b(faq|frequently asked|sss)\b|sık sorulan|sıkça sorulan/i;
const QUESTION_START =
  /^(nasıl|neden|niçin|ne zaman|nedir|hangi|kaç|kim|nerede|how|what|why|which|when|where|who|can|should|is|are|do|does)\b/i;
const SOCIAL_HOSTS =
  /(facebook|instagram|twitter|x\.com|pinterest|youtube|tiktok|linkedin|wa\.me|whatsapp|t\.me|shopify|apple\.com\/app|play\.google)/i;
const ARTICLE_TYPES = ["Article", "BlogPosting", "NewsArticle"] as const;
const CATEGORY_TYPES = [
  "CollectionPage",
  "ItemList",
  "BreadcrumbList",
  "OfferCatalog",
] as const;
const MIN_WORDS: Record<TrackedPageKind, number> = { blog: 800, category: 150 };
const FRESH_DAYS = 365;

export type PageCheck = {
  id: PageCheckId;
  ok: boolean;
  value: number | null;
};

export type KeywordRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  previousClicks: number | null;
  previousPosition: number | null;
};

type KeywordPlacement = {
  inTitle: boolean;
  inHeadings: boolean;
  inBody: boolean;
};

const EXPECTED_CTR = [0.28, 0.15, 0.1, 0.07, 0.05];

function plain(value: string) {
  return value
    .replace(TAG_PATTERN, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function folded(value: string) {
  return tokens(value).join(" ");
}

function covers(haystack: string, query: string) {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) return false;
  return queryTokens.every((token) => haystack.includes(token.slice(0, 5)));
}

function stringField(node: Record<string, unknown> | null, field: string) {
  const value = node?.[field];
  return typeof value === "string" ? value : null;
}

function metaContent(html: string, name: string) {
  const pattern = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["']`,
    "i",
  );
  return pattern.exec(html)?.[1] ?? null;
}

export function analyzePage(input: {
  html: string;
  url: string;
  kind: TrackedPageKind;
  today: Date;
}) {
  const analysis = analyzeHtml(input.html, input.url, 200, 0);
  const nodes = jsonLdNodes(input.html);
  const headings = [...input.html.matchAll(HEADING_PATTERN)]
    .map((match) => plain(match[2] ?? ""))
    .filter(Boolean)
    .slice(0, 40);
  const article = firstOfType(nodes, ARTICLE_TYPES);
  const published =
    stringField(article, "datePublished") ??
    metaContent(input.html, "article:published_time");
  const modified =
    stringField(article, "dateModified") ??
    metaContent(input.html, "article:modified_time") ??
    published;
  const modifiedTime = modified ? Date.parse(modified) : Number.NaN;
  const ageDays = Number.isNaN(modifiedTime)
    ? null
    : Math.round((input.today.getTime() - modifiedTime) / DAY_MS);
  const hasAuthor =
    Boolean(article?.author) ||
    Boolean(metaContent(input.html, "author")) ||
    /rel=["']author["']/i.test(input.html);
  const external = analysis.links.filter((link) => {
    if (link.isInternal) return false;
    try {
      return !SOCIAL_HOSTS.test(new URL(link.targetUrl).host);
    } catch {
      return false;
    }
  });
  const articleBody = /<article\b[\s\S]*?<\/article>/i.exec(input.html)?.[0];
  const hasStructure =
    /<(table|ol)\b/i.test(input.html) ||
    (articleBody ? /<ul\b/i.test(articleBody) : false);
  const questionHeadings = headings.filter(
    (heading) => heading.endsWith("?") || QUESTION_START.test(heading),
  ).length;
  const missingAlt = analysis.images.filter(
    (image) => !image.alt?.trim(),
  ).length;
  const canonicalOk = analysis.canonical
    ? normalizePageUrl(analysis.canonical) === normalizePageUrl(input.url)
    : false;
  const isBlog = input.kind === "blog";

  const checks: PageCheck[] = [
    {
      id: "title_length",
      ok: analysis.title.length >= 30 && analysis.title.length <= 65,
      value: analysis.title.length,
    },
    {
      id: "meta_description",
      ok:
        analysis.metaDescription.length >= 70 &&
        analysis.metaDescription.length <= 160,
      value: analysis.metaDescription.length,
    },
    {
      id: "single_h1",
      ok: analysis.h1s.length === 1,
      value: analysis.h1s.length,
    },
    isBlog
      ? { id: "article_schema", ok: article !== null, value: null }
      : {
          id: "category_schema",
          ok: hasType(nodes, CATEGORY_TYPES),
          value: null,
        },
    { id: "image_alt", ok: missingAlt === 0, value: missingAlt },
    {
      id: "word_count",
      ok: analysis.wordCount >= MIN_WORDS[input.kind],
      value: analysis.wordCount,
    },
    { id: "canonical", ok: canonicalOk, value: null },
    {
      id: "faq",
      ok:
        hasType(nodes, ["FAQPage"]) ||
        headings.some((heading) => FAQ_HEADING.test(heading)),
      value: null,
    },
    {
      id: "question_headings",
      ok: questionHeadings >= 2,
      value: questionHeadings,
    },
    { id: "lists_tables", ok: hasStructure, value: null },
    { id: "citations", ok: external.length >= 2, value: external.length },
  ];
  if (isBlog) {
    checks.push(
      { id: "author", ok: hasAuthor, value: null },
      { id: "dates", ok: Boolean(published || modified), value: null },
      {
        id: "fresh",
        ok: ageDays !== null && ageDays <= FRESH_DAYS,
        value: ageDays,
      },
    );
  }

  const titleText = folded(`${analysis.title} ${analysis.h1s.join(" ")}`);
  const headingText = folded(headings.join(" "));
  const bodyText = folded(analysis.bodyText.slice(0, 60_000));

  return {
    title: analysis.title,
    metaDescription: analysis.metaDescription,
    h1: analysis.h1s[0] ?? null,
    headings,
    wordCount: analysis.wordCount,
    bodyExcerpt: analysis.bodyText.slice(0, 1500),
    checks,
    linkedKeys: new Set(
      analysis.links
        .filter((link) => link.isInternal)
        .map((link) => normalizePageUrl(link.targetUrl)),
    ),
    placement: (query: string): KeywordPlacement => ({
      inTitle: covers(titleText, query),
      inHeadings: covers(headingText, query),
      inBody: covers(bodyText, query),
    }),
  };
}

export type PageAnalysisResult = ReturnType<typeof analyzePage>;

export function keywordOpportunities(
  keywords: KeywordRow[],
  placement: ((query: string) => KeywordPlacement) | null,
) {
  const opportunities: (KeywordRow & {
    reason: "striking" | "low_ctr";
    placement: KeywordPlacement | null;
  })[] = [];
  for (const row of keywords) {
    const rank = Math.round(row.position);
    const expected = EXPECTED_CTR[rank - 1];
    if (row.position > 3.5 && row.position <= 20 && row.impressions >= 30) {
      opportunities.push({
        ...row,
        reason: "striking",
        placement: placement ? placement(row.query) : null,
      });
    } else if (
      expected !== undefined &&
      row.impressions >= 100 &&
      row.ctr < expected * 0.5
    ) {
      opportunities.push({
        ...row,
        reason: "low_ctr",
        placement: placement ? placement(row.query) : null,
      });
    }
  }
  return sort(opportunities, (a, b) => b.impressions - a.impressions).slice(
    0,
    8,
  );
}
