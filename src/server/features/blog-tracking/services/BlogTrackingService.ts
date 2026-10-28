import { sort } from "remeda";
import {
  GscNotConnectedError,
  GscService,
  isExpectedGrantFailure,
} from "@/server/features/gsc/services/GscService";
import { resolveDateRange } from "@/server/features/gsc/searchAnalytics";
import { previousPeriod } from "@/server/features/gsc/searchPerformanceReport";
import { BlogPostRepository } from "@/server/features/blog-tracking/repositories/BlogPostRepository";
import { PageTrackingRepository } from "@/server/features/blog-tracking/repositories/PageTrackingRepository";
import {
  buildBlogPostRows,
  normalizePageUrl,
  suggestBlogPages,
} from "@/server/features/blog-tracking/services/blogTrackingReport";
import { addDays } from "@/server/features/blog-tracking/services/blogAlerts";
import {
  fetchAiReferrals,
  pathKey,
} from "@/server/features/blog-tracking/services/aiReferrals";
import { BlogWeeklyCheckService } from "@/server/features/blog-tracking/services/BlogWeeklyCheckService";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import type { TrackedPageKind } from "@/shared/pageTracking";
import type { BlogTrackingDateRange } from "@/types/schemas/blog-tracking";

const PAGE_ROW_LIMIT = 5000;
const QUERY_PAGE_ROW_LIMIT = 25000;
const TREND_WEEKS = 52;
const CANNIBAL_MIN_IMPRESSIONS = 10;
const CANNIBAL_SHARE = 0.3;
const CANNIBAL_PER_POST = 3;
const STRIKING_WEIGHT = 0.03;

type BlogPostFields = {
  title: string | null;
  targetKeyword: string | null;
  publishedAt: string | null;
};

type StoredPost = Awaited<ReturnType<typeof BlogPostRepository.list>>[number];

function isExpectedConnectionFailure(error: unknown) {
  return error instanceof GscNotConnectedError || isExpectedGrantFailure(error);
}

async function fetchSearchData(
  projectId: string,
  dateRange: BlogTrackingDateRange,
) {
  const { startDate, endDate } = resolveDateRange({ dateRange });
  const previous = previousPeriod(startDate, endDate);
  const [currentPages, previousPages, queryPages] = await Promise.all([
    GscService.getPerformance({
      projectId,
      startDate,
      endDate,
      dimensions: ["page"],
      rowLimit: PAGE_ROW_LIMIT,
    }),
    GscService.getPerformance({
      projectId,
      startDate: previous.startDate,
      endDate: previous.endDate,
      dimensions: ["page"],
      rowLimit: PAGE_ROW_LIMIT,
    }),
    GscService.getPerformance({
      projectId,
      startDate,
      endDate,
      dimensions: ["query", "page"],
      rowLimit: QUERY_PAGE_ROW_LIMIT,
    }),
  ]);
  return {
    range: {
      startDate,
      endDate,
      previousStartDate: previous.startDate,
      previousEndDate: previous.endDate,
    },
    currentPages: currentPages.rows,
    previousPages: previousPages.rows,
    queryPages: queryPages.rows,
  };
}

function competingPages(
  posts: StoredPost[],
  queryPages: GscSearchAnalyticsRow[],
) {
  const pagesByQuery = new Map<
    string,
    { key: string; url: string; impressions: number }[]
  >();
  for (const row of queryPages) {
    const query = row.keys?.[0];
    const page = row.keys?.[1];
    if (!query || !page || row.impressions < CANNIBAL_MIN_IMPRESSIONS) continue;
    const list = pagesByQuery.get(query) ?? [];
    list.push({
      key: normalizePageUrl(page),
      url: page,
      impressions: row.impressions,
    });
    pagesByQuery.set(query, list);
  }
  const result = new Map<string, { query: string; url: string }[]>();
  for (const post of posts) {
    const key = normalizePageUrl(post.url);
    const found: { query: string; url: string; impressions: number }[] = [];
    for (const [query, pages] of pagesByQuery) {
      const own = pages.find((page) => page.key === key);
      if (!own) continue;
      const rival = sort(
        pages.filter(
          (page) =>
            page.key !== key &&
            page.impressions >= own.impressions * CANNIBAL_SHARE,
        ),
        (a, b) => b.impressions - a.impressions,
      )[0];
      if (rival)
        found.push({ query, url: rival.url, impressions: own.impressions });
    }
    result.set(
      post.id,
      sort(found, (a, b) => b.impressions - a.impressions)
        .slice(0, CANNIBAL_PER_POST)
        .map(({ query, url }) => ({ query, url })),
    );
  }
  return result;
}

function aiCitationsByKey(
  rows: Awaited<ReturnType<typeof PageTrackingRepository.listAiCitations>>,
) {
  type Engine = (typeof rows)[number]["engine"];
  const byKey = new Map<string, { count: number; engines: Set<Engine> }>();
  for (const row of rows) {
    const key = normalizePageUrl(row.url);
    const entry = byKey.get(key) ?? { count: 0, engines: new Set<Engine>() };
    entry.count += 1;
    entry.engines.add(row.engine);
    byKey.set(key, entry);
  }
  return byKey;
}

function postDomains(posts: StoredPost[]) {
  const hosts = new Set<string>();
  for (const post of posts) {
    try {
      const host = new URL(post.url).host.toLowerCase().replace(/^www\./, "");
      hosts.add(host);
      hosts.add(`www.${host}`);
    } catch {
      continue;
    }
  }
  return [...hosts];
}

async function weeklyTrend(projectId: string, posts: StoredPost[]) {
  const latest = await PageTrackingRepository.latestWeek(projectId);
  if (!latest || posts.length === 0) return { latestWeek: latest, weeks: [] };
  const kindByKey = new Map<string, TrackedPageKind>(
    posts.map((post) => [normalizePageUrl(post.url), post.kind]),
  );
  const stats = await PageTrackingRepository.listStats(
    projectId,
    [...kindByKey.keys()],
    addDays(latest, -7 * (TREND_WEEKS - 1)),
  );
  const byWeek = new Map<
    string,
    {
      weekStart: string;
      kind: TrackedPageKind;
      clicks: number;
      impressions: number;
    }
  >();
  for (const stat of stats) {
    const kind = kindByKey.get(stat.pageKey);
    if (!kind) continue;
    const id = `${stat.weekStart}\n${kind}`;
    const entry = byWeek.get(id) ?? {
      weekStart: stat.weekStart,
      kind,
      clicks: 0,
      impressions: 0,
    };
    entry.clicks += stat.clicks;
    entry.impressions += stat.impressions;
    byWeek.set(id, entry);
  }
  return {
    latestWeek: latest,
    weeks: sort([...byWeek.values()], (a, b) =>
      a.weekStart.localeCompare(b.weekStart),
    ),
  };
}

async function getReport(projectId: string, dateRange: BlogTrackingDateRange) {
  const posts = await BlogPostRepository.list(projectId);
  const [trend, alerts, citations] = await Promise.all([
    weeklyTrend(projectId, posts),
    PageTrackingRepository.listOpenAlerts(projectId),
    PageTrackingRepository.listAiCitations(projectId, postDomains(posts)),
  ]);
  const citationMap = aiCitationsByKey(citations);
  const withExtras = (
    rows: ReturnType<typeof buildBlogPostRows>,
    extras: {
      competing: Map<string, { query: string; url: string }[]>;
      referrals: Awaited<ReturnType<typeof fetchAiReferrals>>;
    } | null,
  ) =>
    rows.map((row, index) => {
      const post = posts[index];
      const citation = citationMap.get(normalizePageUrl(row.url));
      const lostClicks = Math.max(
        0,
        (row.previous?.clicks ?? 0) - (row.current?.clicks ?? 0),
      );
      const striking =
        row.current && row.current.position >= 4 && row.current.position <= 15
          ? row.current.impressions * STRIKING_WEIGHT
          : 0;
      return {
        ...row,
        kind: post?.kind ?? "blog",
        source: post?.source ?? "manual",
        competing: extras?.competing.get(row.id) ?? [],
        aiReferral: extras?.referrals?.get(pathKey(row.url)) ?? null,
        aiCitations: citation
          ? { count: citation.count, engines: [...citation.engines] }
          : null,
        updatePriority: Math.round(lostClicks + striking),
      };
    });
  const shared = {
    latestWeek: trend.latestWeek,
    trend: trend.weeks,
    alerts,
  };
  try {
    const data = await fetchSearchData(projectId, dateRange);
    const referrals = await fetchAiReferrals(projectId, {
      startDate: data.range.startDate,
      endDate: data.range.endDate,
    });
    return {
      connected: true as const,
      range: data.range,
      ga4Connected: referrals !== null,
      posts: withExtras(buildBlogPostRows(posts, data), {
        competing: competingPages(posts, data.queryPages),
        referrals,
      }),
      suggestions: suggestBlogPages(
        data.currentPages,
        posts.map((post) => post.url),
      ),
      ...shared,
    };
  } catch (error) {
    if (!isExpectedConnectionFailure(error)) throw error;
    return {
      connected: false as const,
      range: null,
      ga4Connected: false,
      posts: withExtras(buildBlogPostRows(posts, null), null),
      suggestions: [],
      ...shared,
    };
  }
}

async function addPosts(
  projectId: string,
  posts: (BlogPostFields & { url: string; kind: TrackedPageKind })[],
) {
  await BlogPostRepository.upsert(projectId, posts);
  return { added: posts.length };
}

async function updatePost(
  projectId: string,
  id: string,
  fields: BlogPostFields,
) {
  await BlogPostRepository.update(projectId, id, fields);
  return { ok: true as const };
}

async function removePosts(projectId: string, ids: string[]) {
  await BlogPostRepository.archive(projectId, ids);
  return { removed: ids.length };
}

async function markAlertsSeen(projectId: string, ids: string[]) {
  await PageTrackingRepository.markAlertsSeen(projectId, ids);
  return { ok: true as const };
}

async function runCheckNow(projectId: string) {
  try {
    const result = await BlogWeeklyCheckService.checkProject(projectId);
    return { connected: true as const, ...result };
  } catch (error) {
    if (!isExpectedConnectionFailure(error)) throw error;
    return { connected: false as const, filledWeeks: 0, caughtUp: false };
  }
}

export const BlogTrackingService = {
  getReport,
  addPosts,
  updatePost,
  removePosts,
  markAlertsSeen,
  runCheckNow,
};
