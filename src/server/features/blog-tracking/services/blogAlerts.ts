import { sort } from "remeda";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import { normalizePageUrl } from "@/server/features/blog-tracking/services/blogTrackingReport";
import type { PageAlertInput } from "@/server/features/blog-tracking/repositories/PageTrackingRepository";

const DAY_MS = 24 * 60 * 60 * 1000;
const GSC_DATA_LAG_DAYS = 3;
const WINDOW_WEEKS = 4;
const DROP_RATIO = 0.7;
const RISE_RATIO = 1.3;
const MIN_TREND_CLICKS = 10;
const MIN_POSITION_IMPRESSIONS = 50;
const POSITION_DROP = 3;
const LOST_KEYWORD_MIN_CLICKS = 3;
const LOST_KEYWORD_POSITION = 20;
const LOST_KEYWORDS_PER_POST = 3;
const NEW_PAGE_DAYS = 30;

type WeeklyStat = {
  pageKey: string;
  weekStart: string;
  clicks: number;
  impressions: number;
  position: number;
};

type AlertPost = {
  id: string;
  url: string;
  publishedAt: string | null;
};

type WindowTotals = { clicks: number; impressions: number; position: number };

function formatDay(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

export function addDays(day: string, days: number) {
  return formatDay(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS);
}

export function lastCompleteWeekStart(today: Date) {
  const cutoff = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate() - GSC_DATA_LAG_DAYS,
  );
  const weekday = (new Date(cutoff).getUTCDay() + 6) % 7;
  const thisMonday = cutoff - weekday * DAY_MS;
  const sunday = thisMonday + 6 * DAY_MS;
  return formatDay(sunday <= cutoff ? thisMonday : thisMonday - 7 * DAY_MS);
}

export function alertWindows(weekStart: string) {
  const currentStart = addDays(weekStart, -7 * (WINDOW_WEEKS - 1));
  const previousStart = addDays(currentStart, -7 * WINDOW_WEEKS);
  return {
    current: { startDate: currentStart, endDate: addDays(weekStart, 6) },
    previous: { startDate: previousStart, endDate: addDays(currentStart, -1) },
  };
}

function totals(stats: WeeklyStat[]): WindowTotals {
  let clicks = 0;
  let impressions = 0;
  let weighted = 0;
  for (const stat of stats) {
    clicks += stat.clicks;
    impressions += stat.impressions;
    weighted += stat.position * stat.impressions;
  }
  return {
    clicks,
    impressions,
    position: impressions > 0 ? weighted / impressions : 0,
  };
}

function queriesByPage(rows: GscSearchAnalyticsRow[]) {
  const byPage = new Map<string, Map<string, GscSearchAnalyticsRow>>();
  for (const row of rows) {
    const query = row.keys?.[0];
    const page = row.keys?.[1];
    if (!query || !page) continue;
    const key = normalizePageUrl(page);
    const queries = byPage.get(key) ?? new Map<string, GscSearchAnalyticsRow>();
    const existing = queries.get(query);
    if (!existing || row.clicks > existing.clicks) queries.set(query, row);
    byPage.set(key, queries);
  }
  return byPage;
}

function isOlderThan(day: string | null, days: number, reference: string) {
  if (!day) return false;
  const time = Date.parse(day);
  if (Number.isNaN(time)) return false;
  return Date.parse(`${reference}T00:00:00Z`) - time > days * DAY_MS;
}

export function evaluatePageAlerts(input: {
  weekStart: string;
  posts: AlertPost[];
  stats: WeeklyStat[];
  currentQueries: GscSearchAnalyticsRow[];
  previousQueries: GscSearchAnalyticsRow[];
  recentAlertKeys: Set<string>;
}): PageAlertInput[] {
  const windows = alertWindows(input.weekStart);
  const statsByPage = new Map<string, WeeklyStat[]>();
  for (const stat of input.stats) {
    const list = statsByPage.get(stat.pageKey) ?? [];
    list.push(stat);
    statsByPage.set(stat.pageKey, list);
  }
  const current = queriesByPage(input.currentQueries);
  const previous = queriesByPage(input.previousQueries);
  const alerts: PageAlertInput[] = [];
  const push = (alert: PageAlertInput) => {
    const key = `${alert.postId}\n${alert.kind}\n${alert.query}`;
    if (!input.recentAlertKeys.has(key)) alerts.push(alert);
  };

  for (const post of input.posts) {
    const key = normalizePageUrl(post.url);
    const pageStats = statsByPage.get(key) ?? [];
    const now = totals(
      pageStats.filter((stat) => stat.weekStart >= windows.current.startDate),
    );
    const before = totals(
      pageStats.filter(
        (stat) =>
          stat.weekStart >= windows.previous.startDate &&
          stat.weekStart < windows.current.startDate,
      ),
    );
    const base = { postId: post.id, query: "" };

    if (
      before.clicks >= MIN_TREND_CLICKS &&
      now.clicks <= before.clicks * DROP_RATIO
    ) {
      push({
        ...base,
        kind: "clicks_drop",
        previousValue: before.clicks,
        currentValue: now.clicks,
      });
    } else if (
      now.clicks >= MIN_TREND_CLICKS &&
      now.clicks >= before.clicks * RISE_RATIO &&
      now.clicks > before.clicks
    ) {
      push({
        ...base,
        kind: "rising",
        previousValue: before.clicks,
        currentValue: now.clicks,
      });
    }

    if (
      now.impressions >= MIN_POSITION_IMPRESSIONS &&
      before.impressions >= MIN_POSITION_IMPRESSIONS &&
      now.position - before.position >= POSITION_DROP
    ) {
      push({
        ...base,
        kind: "position_drop",
        previousValue: before.position,
        currentValue: now.position,
      });
    }

    if (
      now.impressions === 0 &&
      (before.impressions > 0 ||
        isOlderThan(post.publishedAt, NEW_PAGE_DAYS, input.weekStart))
    ) {
      push({
        ...base,
        kind: "no_impressions",
        previousValue: before.impressions,
        currentValue: 0,
      });
    }

    const nowQueries = current.get(key);
    const lost = sort(
      [...(previous.get(key)?.values() ?? [])]
        .filter((row) => row.clicks >= LOST_KEYWORD_MIN_CLICKS)
        .filter((row) => {
          const match = nowQueries?.get(row.keys?.[0] ?? "");
          return !match || match.position > LOST_KEYWORD_POSITION;
        }),
      (a, b) => b.clicks - a.clicks,
    ).slice(0, LOST_KEYWORDS_PER_POST);
    for (const row of lost) {
      const query = row.keys?.[0] ?? "";
      push({
        postId: post.id,
        kind: "keyword_lost",
        query,
        previousValue: row.position,
        currentValue: nowQueries?.get(query)?.position ?? 0,
      });
    }
  }
  return alerts;
}
