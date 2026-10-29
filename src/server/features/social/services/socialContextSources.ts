import { sortBy } from "remeda";
import { BlogPostRepository } from "@/server/features/blog-tracking/repositories/BlogPostRepository";
import { BlogDraftRepository } from "@/server/features/blog-writer/repositories/BlogDraftRepository";
import { Ga4ReportingService } from "@/server/features/ga4/services/Ga4ReportingService";
import { GscService } from "@/server/features/gsc/services/GscService";
import { RankTrackingService } from "@/server/features/rank-tracking/services/RankTrackingService";
import { SocialPostRepository } from "@/server/features/social/repositories/SocialPostRepository";

type Row = Record<string, unknown>;
type Cell = string | number | null;

function cell(value: unknown): Cell {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function toSearchRow(row: {
  keys?: string[];
  clicks: number;
  impressions: number;
  position: number;
}) {
  return {
    key: row.keys?.[0] ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
    position: Math.round(row.position * 10) / 10,
  };
}

function isoDay(offsetDays: number) {
  return new Date(Date.now() - offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export async function loadSearchConsole(projectId: string) {
  const performance = (
    start: number,
    end: number,
    dimension: "query" | "page",
  ) =>
    GscService.getPerformance({
      projectId,
      startDate: isoDay(start),
      endDate: isoDay(end),
      dimensions: [dimension],
      rowLimit: 1000,
    });
  const [queries, previous, pages] = await Promise.all([
    performance(31, 3, "query"),
    performance(59, 32, "query"),
    performance(31, 3, "page"),
  ]);
  const current = queries.rows.map(toSearchRow);
  const before = new Map(
    previous.rows.map((row) => [row.keys?.[0] ?? "", row.impressions]),
  );
  const rising = sortBy(
    current
      .map((row) => ({ ...row, previousImpressions: before.get(row.key) ?? 0 }))
      .filter(
        (row) =>
          row.impressions >= 20 &&
          row.impressions > row.previousImpressions * 1.3,
      ),
    [(row) => row.impressions - row.previousImpressions, "desc"],
  ).slice(0, 20);
  return {
    period: `${isoDay(31)}..${isoDay(3)}`,
    topQueriesByClicks: sortBy(current, [(row) => row.clicks, "desc"]).slice(
      0,
      25,
    ),
    topQueriesByImpressions: sortBy(current, [
      (row) => row.impressions,
      "desc",
    ]).slice(0, 25),
    risingQueries: rising,
    topPages: sortBy(pages.rows.map(toSearchRow), [
      (row) => row.clicks,
      "desc",
    ]).slice(0, 20),
  };
}

function pickGa4(rows: Row[], keys: string[]) {
  return rows.map(
    (row): Record<string, Cell> =>
      Object.fromEntries(
        keys.filter((key) => key in row).map((key) => [key, cell(row[key])]),
      ),
  );
}

export async function loadAnalytics(projectId: string) {
  const [landing, items] = await Promise.all([
    Ga4ReportingService.runReport({
      projectId,
      kind: "landing_pages",
      channel: "all",
      limit: 20,
    }),
    Ga4ReportingService.runReport({
      projectId,
      kind: "ecommerce_performance",
      channel: "all",
      ecommerceBreakdown: "item",
      limit: 20,
    }),
  ]);
  return {
    topLandingPages: pickGa4(landing.rows, [
      "landingPage",
      "sessions",
      "keyEvents",
      "transactions",
      "purchaseRevenue",
    ]),
    topItems: pickGa4(items.rows, [
      "itemName",
      "itemsPurchased",
      "itemRevenue",
      "itemsViewed",
    ]),
  };
}

export async function loadRankTracking(projectId: string) {
  const configs = await RankTrackingService.getConfigs(projectId);
  const trackers = await Promise.all(
    configs
      .slice(0, 3)
      .map((config) => RankTrackingService.getTracker(config.id, projectId)),
  );
  return trackers.flatMap(({ results }) =>
    results.rows.slice(0, 60).map((row) => {
      const device = row.mobile.position !== null ? row.mobile : row.desktop;
      return {
        keyword: row.keyword,
        position: device.position,
        previousPosition: device.previousPosition,
        url: device.rankingUrl,
        searchVolume: row.searchVolume,
      };
    }),
  );
}

export async function loadContentHistory(projectId: string) {
  const [drafts, tracked, posts] = await Promise.all([
    BlogDraftRepository.list(projectId),
    BlogPostRepository.list(projectId),
    SocialPostRepository.listRecent(projectId, 80),
  ]);
  const media = await SocialPostRepository.listMedia(
    posts.map((post) => post.id),
  );
  return {
    blogDrafts: drafts.slice(0, 60).map((draft) => ({
      title: draft.title,
      targetKeyword: draft.targetKeyword,
      status: draft.status,
      url: draft.publishedUrl,
    })),
    trackedPages: tracked.slice(-60).map((post) => ({
      title: post.title,
      url: post.url,
      targetKeyword: post.targetKeyword,
      publishedAt: post.publishedAt,
    })),
    socialPosts: posts.map((post) => ({
      id: post.id,
      platform: post.platform,
      format: post.format,
      status: post.status,
      title: post.title,
      hook: post.hook,
      targetKeyword: post.targetKeyword,
      linkUrl: post.linkUrl,
      scheduledAt: post.scheduledAt,
      images: media
        .filter((item) => item.postId === post.id)
        .map((item) => item.asset.sourceUrl ?? item.asset.url),
    })),
  };
}
