import { GscService } from "@/server/features/gsc/services/GscService";
import { BlogPostRepository } from "@/server/features/blog-tracking/repositories/BlogPostRepository";
import { PageTrackingRepository } from "@/server/features/blog-tracking/repositories/PageTrackingRepository";
import {
  addDays,
  alertWindows,
  evaluatePageAlerts,
  lastCompleteWeekStart,
} from "@/server/features/blog-tracking/services/blogAlerts";
import {
  normalizePageUrl,
  toMetricsByUrl,
} from "@/server/features/blog-tracking/services/blogTrackingReport";
import { classifyPath } from "@/server/features/blog-writer/services/siteLinkTargets";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import type { TrackedPageKind } from "@/shared/pageTracking";

const HISTORY_WEEKS = 52;
const MAX_WEEKS_PER_RUN = 13;
const GSC_ROW_LIMIT = 25000;
const DISCOVERY_MIN_IMPRESSIONS = 5;
const MAX_DISCOVERED_PER_RUN = 300;
const ALERT_DEDUPE_WEEKS = 3;

function weeksToFill(latest: string | null, target: string) {
  const oldest = addDays(target, -7 * (HISTORY_WEEKS - 1));
  const first = latest && latest >= oldest ? addDays(latest, 7) : oldest;
  const weeks: string[] = [];
  for (let week = first; week <= target; week = addDays(week, 7)) {
    weeks.push(week);
    if (weeks.length === MAX_WEEKS_PER_RUN) break;
  }
  return weeks;
}

function discoverPages(
  rows: { keys?: string[]; impressions: number }[],
  knownKeys: Set<string>,
) {
  const found = new Map<string, { url: string; kind: TrackedPageKind }>();
  for (const row of rows) {
    const page = row.keys?.[0];
    if (!page || row.impressions < DISCOVERY_MIN_IMPRESSIONS) continue;
    let parsed: URL;
    try {
      parsed = new URL(page);
    } catch {
      continue;
    }
    if (parsed.search || parsed.hash) continue;
    const kind = classifyPath(parsed.pathname);
    if (kind !== "blog_post" && kind !== "category") continue;
    const key = normalizePageUrl(page);
    if (knownKeys.has(key) || found.has(key)) continue;
    found.set(key, {
      url: page,
      kind: kind === "blog_post" ? "blog" : "category",
    });
    if (found.size === MAX_DISCOVERED_PER_RUN) break;
  }
  return [...found.values()];
}

async function fetchPageRows(
  projectId: string,
  startDate: string,
  endDate: string,
) {
  const result = await GscService.getPerformance({
    projectId,
    startDate,
    endDate,
    dimensions: ["page"],
    rowLimit: GSC_ROW_LIMIT,
  });
  return result.rows;
}

async function fetchQueryPageRows(
  projectId: string,
  range: { startDate: string; endDate: string },
) {
  const result = await GscService.getPerformance({
    projectId,
    ...range,
    dimensions: ["query", "page"],
    rowLimit: GSC_ROW_LIMIT,
  });
  return result.rows;
}

async function raiseAlerts(projectId: string, weekStart: string) {
  const posts = await BlogPostRepository.list(projectId);
  if (posts.length === 0) return;
  const windows = alertWindows(weekStart);
  const [stats, currentQueries, previousQueries, recentAlertKeys] =
    await Promise.all([
      PageTrackingRepository.listStats(
        projectId,
        [...new Set(posts.map((post) => normalizePageUrl(post.url)))],
        windows.previous.startDate,
      ),
      fetchQueryPageRows(projectId, windows.current),
      fetchQueryPageRows(projectId, windows.previous),
      PageTrackingRepository.listRecentAlertKeys(
        projectId,
        addDays(weekStart, -7 * ALERT_DEDUPE_WEEKS),
      ),
    ]);
  const alerts = evaluatePageAlerts({
    weekStart,
    posts,
    stats,
    currentQueries,
    previousQueries,
    recentAlertKeys,
  });
  await PageTrackingRepository.addAlerts(projectId, weekStart, alerts);
}

async function checkProject(projectId: string, today: Date = new Date()) {
  const target = lastCompleteWeekStart(today);
  const latest = await PageTrackingRepository.latestWeek(projectId);
  const weeks = weeksToFill(latest, target);
  let targetRows: GscSearchAnalyticsRow[] | null = null;
  for (const week of weeks) {
    const rows = await fetchPageRows(projectId, week, addDays(week, 6));
    const metrics = toMetricsByUrl(rows);
    await PageTrackingRepository.saveWeek(
      projectId,
      week,
      [...metrics.entries()].map(([pageKey, value]) => ({
        pageKey,
        clicks: value.clicks,
        impressions: value.impressions,
        position: value.position,
      })),
    );
    if (week === target) targetRows = rows;
  }
  const knownKeys = new Set(
    (await BlogPostRepository.listAllUrls(projectId)).map(normalizePageUrl),
  );
  await BlogPostRepository.addDiscovered(
    projectId,
    discoverPages(
      targetRows ??
        (await fetchPageRows(projectId, target, addDays(target, 6))),
      knownKeys,
    ),
  );
  const caughtUp = weeks.length === 0 || weeks.at(-1) === target;
  if (caughtUp && targetRows) await raiseAlerts(projectId, target);
  return {
    filledWeeks: weeks.length,
    caughtUp,
  };
}

export async function runWeeklyPageChecks(today: Date = new Date()) {
  const projectIds = await PageTrackingRepository.listConnectedProjectIds();
  let failed = 0;
  for (const projectId of projectIds) {
    try {
      await checkProject(projectId, today);
    } catch (error) {
      failed++;
      console.error("[page-tracking] weekly check failed", {
        projectId,
        error,
      });
    }
  }
  console.log("[page-tracking] weekly checks done", {
    projects: projectIds.length,
    failed,
  });
}

export const BlogWeeklyCheckService = { checkProject };
