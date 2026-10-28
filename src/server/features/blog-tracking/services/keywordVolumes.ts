import type { BillingCustomerContext } from "@/server/billing/subscription";
import { KeywordResearchRepository } from "@/server/features/keywords/repositories/KeywordResearchRepository";
import { normalizeIntent } from "@/server/features/keywords/services/research/helpers";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import { PageTrackingRepository } from "@/server/features/blog-tracking/repositories/PageTrackingRepository";
import {
  createDataforseoClient,
  fetchKeywordMetricsForList,
} from "@/server/lib/dataforseo";

const CACHE_DAYS = 30;
const MAX_KEYWORD_CHARS = 80;
const MAX_KEYWORD_WORDS = 10;

function isMeasurable(keyword: string) {
  return (
    keyword.length <= MAX_KEYWORD_CHARS &&
    keyword.trim().split(/\s+/).length <= MAX_KEYWORD_WORDS
  );
}

export async function keywordVolumes(
  projectId: string,
  keywords: string[],
  customer: BillingCustomerContext | null,
): Promise<Map<string, number | null>> {
  const volumes = new Map<string, number | null>();
  const project = await ProjectRepository.getProjectById(projectId);
  const wanted = [...new Set(keywords.filter(isMeasurable))];
  if (!project || wanted.length === 0) return volumes;
  const market = {
    locationCode: project.locationCode,
    languageCode: project.languageCode,
  };
  const cached = await PageTrackingRepository.listKeywordVolumes({
    projectId,
    keywords: wanted,
    ...market,
    since: new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString(),
  });
  for (const row of cached) volumes.set(row.keyword, row.searchVolume);
  const missing = wanted.filter((keyword) => !volumes.has(keyword));
  if (missing.length === 0 || !customer) return volumes;
  try {
    const metrics = await fetchKeywordMetricsForList(
      createDataforseoClient(customer),
      { keywords: missing, ...market, creditFeature: "keyword_research" },
    );
    for (const metric of metrics) {
      const keyword =
        missing.find(
          (item) => item.toLowerCase() === metric.keyword.toLowerCase(),
        ) ?? metric.keyword;
      volumes.set(keyword, metric.searchVolume);
      await KeywordResearchRepository.upsertKeywordMetric({
        projectId,
        keyword,
        ...market,
        searchVolume: metric.searchVolume,
        cpc: metric.cpc,
        competition: metric.competition,
        keywordDifficulty: metric.keywordDifficulty,
        intent: normalizeIntent(metric.intent),
        monthlySearchesJson: JSON.stringify(metric.monthlySearches),
      });
    }
  } catch (error) {
    console.warn("[page-tracking] keyword volumes unavailable", error);
  }
  return volumes;
}
