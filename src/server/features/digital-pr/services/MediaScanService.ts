import { MediaScanRepository } from "@/server/features/digital-pr/repositories/MediaScanRepository";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { createDataforseoClient } from "@/server/lib/dataforseo";
import { AppError } from "@/server/lib/errors";
import { normalizeDomain } from "@/server/features/leads/services/leadSources";
import {
  MediaRepository,
  type ArticleSeed,
  type OutletSeed,
} from "@/server/features/digital-pr/repositories/MediaRepository";
import { MediaEnrichService } from "@/server/features/digital-pr/services/MediaEnrichService";
import {
  addDays,
  MEDIA_SCAN_INTERVAL_DAYS,
  MEDIA_SCAN_LOCK_MINUTES,
  MEDIA_TOPICS_MAX,
  PR_MARKET_TARGETS,
  type MediaScanTrigger,
  type PrMarket,
} from "@/shared/digitalPr";

const NEWS_DEPTH = 50;
const BLOG_DEPTH = 20;
const TOPIC_CONCURRENCY = 4;
const TRAFFIC_CHUNK = 500;

const BLOCKED_DOMAINS = new Set([
  "youtube.com",
  "instagram.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "pinterest.com",
  "linkedin.com",
  "reddit.com",
  "quora.com",
  "medium.com",
  "wikipedia.org",
  "tr.wikipedia.org",
  "en.wikipedia.org",
  "google.com",
  "apple.com",
  "amazon.com",
  "amazon.com.tr",
  "trendyol.com",
  "hepsiburada.com",
  "n11.com",
  "ciceksepeti.com",
  "etsy.com",
  "ebay.com",
  "eksisozluk.com",
  "sikayetvar.com",
  "yandex.com.tr",
  "msn.com",
]);

function isBlocked(domain: string) {
  if (BLOCKED_DOMAINS.has(domain)) return true;
  const root = domain.split(".").slice(-2).join(".");
  if (BLOCKED_DOMAINS.has(root)) return true;
  return /\.gov(\.[a-z]{2})?$|\.edu(\.[a-z]{2})?$|\.mil(\.[a-z]{2})?$/.test(
    domain,
  );
}

function publishedAt(timestamp: string | null | undefined) {
  if (!timestamp) return null;
  const date = new Date(timestamp.replace(" +00:00", "Z").replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function listTopics(organizationId: string) {
  return MediaScanRepository.listTopics(organizationId);
}

async function addTopics(
  organizationId: string,
  keywords: string[],
  market: PrMarket,
) {
  const existing = await MediaScanRepository.listTopics(organizationId);
  const clean = [
    ...new Set(
      keywords
        .map((keyword) => keyword.replace(/\s+/g, " ").trim().toLowerCase())
        .filter((keyword) => keyword.length >= 2 && keyword.length <= 80),
    ),
  ];
  if (existing.length + clean.length > MEDIA_TOPICS_MAX) {
    throw new AppError(
      "VALIDATION_ERROR",
      `You can keep up to ${MEDIA_TOPICS_MAX} topics.`,
    );
  }
  await MediaScanRepository.addTopics(
    organizationId,
    clean.map((keyword) => ({ keyword, market })),
  );
}

async function deleteTopic(organizationId: string, topicId: string) {
  await MediaScanRepository.deleteTopic(organizationId, topicId);
}

async function getOverview(organizationId: string) {
  const [settings, runs, pending, topics] = await Promise.all([
    MediaScanRepository.getSettings(organizationId),
    MediaScanRepository.listRuns(organizationId, 5),
    MediaScanRepository.pendingCounts(organizationId),
    MediaScanRepository.listTopics(organizationId),
  ]);
  return {
    autoRun: settings?.autoRun ?? false,
    nextRunAt: settings?.nextRunAt ?? null,
    lastRunAt: settings?.lastRunAt ?? null,
    running: Boolean(
      settings?.runningRunId &&
      settings.runStartedAt &&
      settings.runStartedAt > staleBefore(new Date().toISOString()),
    ),
    runs,
    pending,
    topics,
  };
}

async function setSchedule(organizationId: string, autoRun: boolean) {
  const settings = await MediaScanRepository.getSettings(organizationId);
  const now = new Date().toISOString();
  await MediaScanRepository.setSchedule(organizationId, {
    autoRun,
    nextRunAt: autoRun
      ? (settings?.nextRunAt ?? addDays(now, MEDIA_SCAN_INTERVAL_DAYS))
      : null,
  });
}

function staleBefore(now: string) {
  return new Date(
    new Date(now).getTime() - MEDIA_SCAN_LOCK_MINUTES * 60 * 1000,
  ).toISOString();
}

type TopicHarvest = {
  outlets: OutletSeed[];
  articles: (Omit<ArticleSeed, "outletId"> & { domain: string })[];
  links: { domain: string; topicId: string }[];
};

async function harvestTopic(
  client: ReturnType<typeof createDataforseoClient>,
  topic: { id: string; keyword: string; market: PrMarket },
): Promise<TopicHarvest> {
  const target = PR_MARKET_TARGETS[topic.market];
  const [news, blogs] = await Promise.all([
    client.serp.news({
      keyword: topic.keyword,
      locationCode: target.locationCode,
      languageCode: target.languageCode,
      depth: NEWS_DEPTH,
    }),
    client.serp.live({
      keyword: `${topic.keyword} blog`,
      locationCode: target.locationCode,
      languageCode: target.languageCode,
      depth: BLOG_DEPTH,
    }),
  ]);
  const harvest: TopicHarvest = { outlets: [], articles: [], links: [] };
  for (const item of news) {
    if (item.type !== "news_search" || !item.url) continue;
    const domain = normalizeDomain(item.domain ?? item.url);
    if (!domain || isBlocked(domain)) continue;
    harvest.outlets.push({
      domain,
      name: item.source?.trim() || null,
      type: "news",
      market: topic.market,
      source: "news",
      homepageUrl: `https://${domain}/`,
    });
    harvest.articles.push({
      domain,
      topicId: topic.id,
      url: item.url,
      title: item.title?.trim() || null,
      publishedAt: publishedAt(item.timestamp),
    });
    harvest.links.push({ domain, topicId: topic.id });
  }
  for (const item of blogs) {
    if (item.type !== "organic" || !item.url) continue;
    const domain = normalizeDomain(item.domain ?? item.url);
    if (!domain || isBlocked(domain)) continue;
    harvest.outlets.push({
      domain,
      name: null,
      type: "blog",
      market: topic.market,
      source: "search",
      homepageUrl: `https://${domain}/`,
    });
    harvest.articles.push({
      domain,
      topicId: topic.id,
      url: item.url,
      title: item.title?.trim() || null,
      publishedAt: null,
    });
    harvest.links.push({ domain, topicId: topic.id });
  }
  return harvest;
}

async function runScan(
  organizationId: string,
  trigger: MediaScanTrigger,
  billing: BillingCustomerContext,
) {
  const topics = await MediaScanRepository.listTopics(organizationId);
  if (topics.length === 0) {
    throw new AppError("VALIDATION_ERROR", "Add at least one topic first.");
  }
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const claimed = await MediaScanRepository.claimRunLock(
    organizationId,
    runId,
    startedAt,
    staleBefore(startedAt),
  );
  if (!claimed) {
    throw new AppError("CONFLICT", "A media scan is already running.");
  }
  await MediaScanRepository.createRun(
    organizationId,
    runId,
    trigger,
    startedAt,
  );

  const stats = {
    topicsScanned: 0,
    outletsFound: 0,
    outletsAdded: 0,
    articlesAdded: 0,
  };
  try {
    const client = createDataforseoClient(billing);
    const harvests: TopicHarvest[] = [];
    let firstError: unknown = null;
    for (let i = 0; i < topics.length; i += TOPIC_CONCURRENCY) {
      const settled = await Promise.allSettled(
        topics
          .slice(i, i + TOPIC_CONCURRENCY)
          .map((topic) => harvestTopic(client, topic)),
      );
      for (const result of settled) {
        if (result.status === "fulfilled") {
          harvests.push(result.value);
          stats.topicsScanned++;
        } else {
          firstError ??= result.reason;
          console.error("[media-scan] topic failed", result.reason);
        }
      }
    }
    if (harvests.length === 0 && firstError) throw firstError;

    const seenAt = new Date().toISOString();
    const outlets = harvests.flatMap((harvest) => harvest.outlets);
    const { ids, addedDomains } = await MediaRepository.upsertOutlets(
      organizationId,
      outlets,
      seenAt,
    );
    stats.outletsFound = ids.size;
    stats.outletsAdded = addedDomains.length;
    await MediaRepository.linkOutletTopics(
      harvests.flatMap((harvest) =>
        harvest.links.flatMap((link) => {
          const outletId = ids.get(link.domain);
          return outletId ? [{ outletId, topicId: link.topicId }] : [];
        }),
      ),
      seenAt,
    );
    stats.articlesAdded = await MediaRepository.insertArticles(
      harvests.flatMap((harvest) =>
        harvest.articles.flatMap(({ domain, ...article }) => {
          const outletId = ids.get(domain);
          return outletId ? [{ ...article, outletId }] : [];
        }),
      ),
    );
    await fillTraffic(client, organizationId, outlets, new Set(addedDomains));

    await MediaScanRepository.finishRun(runId, {
      status: "done",
      ...stats,
      error: null,
    });
  } catch (error) {
    await MediaScanRepository.finishRun(runId, {
      status: "failed",
      ...stats,
      error:
        error instanceof Error ? error.message.slice(0, 300) : "Scan failed",
    });
    throw error;
  } finally {
    await MediaScanRepository.releaseRunLock(organizationId, runId, {
      lastRunAt: new Date().toISOString(),
    });
  }
  return { runId, ...stats };
}

async function fillTraffic(
  client: ReturnType<typeof createDataforseoClient>,
  organizationId: string,
  outlets: OutletSeed[],
  addedDomains: Set<string>,
) {
  const byMarket = new Map<PrMarket, string[]>();
  for (const outlet of outlets) {
    if (!addedDomains.has(outlet.domain)) continue;
    const list = byMarket.get(outlet.market) ?? [];
    if (!list.includes(outlet.domain)) list.push(outlet.domain);
    byMarket.set(outlet.market, list);
  }
  for (const [market, domains] of byMarket) {
    const target = PR_MARKET_TARGETS[market];
    for (let i = 0; i < domains.length; i += TRAFFIC_CHUNK) {
      const chunk = domains.slice(i, i + TRAFFIC_CHUNK);
      const rows = await client.domain
        .bulkTraffic({
          targets: chunk,
          locationCode: target.locationCode,
          languageCode: target.languageCode,
        })
        .catch((error: unknown) => {
          console.error("[media-scan] traffic lookup failed", error);
          return [];
        });
      const etvByDomain = new Map(
        rows.map((row) => [normalizeDomain(row.target) ?? row.target, row.etv]),
      );
      await MediaRepository.setOutletTraffic(
        organizationId,
        chunk.map((domain) => ({
          domain,
          organicTraffic:
            etvByDomain.get(domain) == null
              ? null
              : Math.round(etvByDomain.get(domain) ?? 0),
        })),
      );
    }
  }
}

export async function runScheduledMediaScans() {
  const now = new Date().toISOString();
  const [due] = await MediaScanRepository.listDueSettings(now, 1);
  if (due?.nextRunAt) {
    const claimed = await MediaScanRepository.claimDueSchedule(
      due.organizationId,
      due.nextRunAt,
      addDays(now, MEDIA_SCAN_INTERVAL_DAYS),
    );
    if (claimed) {
      try {
        await runScan(due.organizationId, "weekly", {
          organizationId: due.organizationId,
          userId: "system",
          userEmail: "system@openseo.so",
        });
      } catch (error) {
        console.error("[media-scan] scheduled scan failed", {
          organizationId: due.organizationId,
          error,
        });
      }
      return;
    }
  }
  await MediaEnrichService.enrichNext();
}

export const MediaScanService = {
  listTopics,
  addTopics,
  deleteTopic,
  getOverview,
  setSchedule,
  runScan,
};
