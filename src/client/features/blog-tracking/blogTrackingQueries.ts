import { queryOptions } from "@tanstack/react-query";
import {
  getBlogTrackingReport,
  getPageInsights,
} from "@/serverFunctions/blogTracking";
import type { BlogTrackingDateRange } from "@/types/schemas/blog-tracking";

export const blogTrackingQueryKey = (projectId: string) => [
  "blogTracking",
  projectId,
];

export function blogTrackingReportOptions(
  projectId: string,
  dateRange: BlogTrackingDateRange,
) {
  return queryOptions({
    queryKey: [...blogTrackingQueryKey(projectId), "report", dateRange],
    queryFn: () => getBlogTrackingReport({ data: { projectId, dateRange } }),
  });
}

export function pageInsightsQueryKey(
  projectId: string,
  id: string,
  dateRange: BlogTrackingDateRange,
) {
  return [...blogTrackingQueryKey(projectId), "insights", id, dateRange];
}

export function pageInsightsOptions(
  projectId: string,
  id: string,
  dateRange: BlogTrackingDateRange,
) {
  return queryOptions({
    queryKey: pageInsightsQueryKey(projectId, id, dateRange),
    queryFn: () => getPageInsights({ data: { projectId, id, dateRange } }),
    staleTime: 5 * 60 * 1000,
  });
}

export type BlogTrackingReport = Awaited<
  ReturnType<typeof getBlogTrackingReport>
>;
export type BlogPostRow = BlogTrackingReport["posts"][number];
export type BlogSuggestion = BlogTrackingReport["suggestions"][number];
export type PageAlert = BlogTrackingReport["alerts"][number];
export type PageInsights = Awaited<ReturnType<typeof getPageInsights>>;
