import { sort } from "remeda";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import type { BlogPostStatus } from "@/types/schemas/blog-tracking";

const NEW_POST_DAYS = 30;
const TREND_THRESHOLD = 0.2;
const MIN_CLICKS_FOR_TREND = 5;
const BLOG_PATH_PATTERN =
  /\/(blogs?|articles?|news|guides?|journal|stories|makale(ler)?|yazilar|rehber)(\/|$)/i;

type StoredBlogPost = {
  id: string;
  url: string;
  title: string | null;
  targetKeyword: string | null;
  publishedAt: string | null;
  createdAt: string;
};

type PageMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type BlogPostReportRow = StoredBlogPost & {
  current: PageMetrics | null;
  previous: PageMetrics | null;
  clicksChange: number | null;
  targetKeywordPosition: number | null;
  status: BlogPostStatus;
};

export function normalizePageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.protocol}//${parsed.host.toLowerCase().replace(/^www\./, "")}${decodeURI(path)}`;
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, "");
  }
}

export function toMetricsByUrl(rows: GscSearchAnalyticsRow[]) {
  const totals = new Map<
    string,
    { clicks: number; impressions: number; weightedPosition: number }
  >();
  for (const row of rows) {
    const page = row.keys?.[0];
    if (!page) continue;
    const key = normalizePageUrl(page);
    const entry = totals.get(key) ?? {
      clicks: 0,
      impressions: 0,
      weightedPosition: 0,
    };
    entry.clicks += row.clicks;
    entry.impressions += row.impressions;
    entry.weightedPosition += row.position * row.impressions;
    totals.set(key, entry);
  }
  const metrics = new Map<string, PageMetrics>();
  for (const [key, entry] of totals) {
    metrics.set(key, {
      clicks: entry.clicks,
      impressions: entry.impressions,
      ctr: entry.impressions > 0 ? entry.clicks / entry.impressions : 0,
      position:
        entry.impressions > 0 ? entry.weightedPosition / entry.impressions : 0,
    });
  }
  return metrics;
}

function targetKeywordPositions(rows: GscSearchAnalyticsRow[]) {
  const positions = new Map<string, number>();
  for (const row of rows) {
    const query = row.keys?.[0];
    const page = row.keys?.[1];
    if (!query || !page) continue;
    positions.set(
      `${normalizePageUrl(page)}\n${query.trim().toLowerCase()}`,
      row.position,
    );
  }
  return positions;
}

function daysBetween(fromIso: string, to: Date) {
  const from = Date.parse(fromIso);
  if (Number.isNaN(from)) return Number.POSITIVE_INFINITY;
  return (to.getTime() - from) / (24 * 60 * 60 * 1000);
}

function getClicksChange(
  current: PageMetrics | null,
  previous: PageMetrics | null,
) {
  if (!current || !previous || previous.clicks === 0) return null;
  return (current.clicks - previous.clicks) / previous.clicks;
}

function getStatus(
  post: StoredBlogPost,
  current: PageMetrics | null,
  previous: PageMetrics | null,
  today: Date,
): BlogPostStatus {
  if (post.publishedAt && daysBetween(post.publishedAt, today) <= NEW_POST_DAYS)
    return "new";
  const currentClicks = current?.clicks ?? 0;
  const previousClicks = previous?.clicks ?? 0;
  if (!current?.impressions && !previous?.impressions) return "no_data";
  if (
    previousClicks >= MIN_CLICKS_FOR_TREND &&
    currentClicks <= previousClicks * (1 - TREND_THRESHOLD)
  )
    return "declining";
  if (
    currentClicks >= MIN_CLICKS_FOR_TREND &&
    currentClicks >= previousClicks * (1 + TREND_THRESHOLD)
  )
    return "rising";
  return "stable";
}

export function buildBlogPostRows(
  posts: StoredBlogPost[],
  data: {
    currentPages: GscSearchAnalyticsRow[];
    previousPages: GscSearchAnalyticsRow[];
    queryPages: GscSearchAnalyticsRow[];
  } | null,
  today: Date = new Date(),
): BlogPostReportRow[] {
  const current = data
    ? toMetricsByUrl(data.currentPages)
    : new Map<string, PageMetrics>();
  const previous = data
    ? toMetricsByUrl(data.previousPages)
    : new Map<string, PageMetrics>();
  const keywordPositions = data
    ? targetKeywordPositions(data.queryPages)
    : new Map<string, number>();

  return posts.map((post) => {
    const key = normalizePageUrl(post.url);
    const currentMetrics: PageMetrics | null = current.get(key) ?? null;
    const previousMetrics: PageMetrics | null = previous.get(key) ?? null;
    const targetKeywordPosition = post.targetKeyword
      ? (keywordPositions.get(
          `${key}\n${post.targetKeyword.trim().toLowerCase()}`,
        ) ?? null)
      : null;
    return {
      ...post,
      current: currentMetrics,
      previous: previousMetrics,
      clicksChange: getClicksChange(currentMetrics, previousMetrics),
      targetKeywordPosition,
      status: data
        ? getStatus(post, currentMetrics, previousMetrics, today)
        : "no_data",
    };
  });
}

export function suggestBlogPages(
  pageRows: GscSearchAnalyticsRow[],
  trackedUrls: string[],
  limit = 20,
) {
  const tracked = new Set(trackedUrls.map(normalizePageUrl));
  const metrics = toMetricsByUrl(
    pageRows.filter((row) => {
      const page = row.keys?.[0];
      if (!page) return false;
      try {
        return BLOG_PATH_PATTERN.test(new URL(page).pathname);
      } catch {
        return false;
      }
    }),
  );
  const urlByKey = new Map<string, string>();
  for (const row of pageRows) {
    const page = row.keys?.[0];
    if (page && !urlByKey.has(normalizePageUrl(page)))
      urlByKey.set(normalizePageUrl(page), page);
  }
  return sort(
    [...metrics.entries()]
      .filter(([key]) => !tracked.has(key))
      .map(([key, value]) => ({ url: urlByKey.get(key) ?? key, ...value })),
    (a, b) => b.impressions - a.impressions,
  ).slice(0, limit);
}
