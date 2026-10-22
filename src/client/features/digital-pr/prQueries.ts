import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import {
  getCompetitorGap,
  getGapSetup,
  getMediaOverview,
  listMediaOutlets,
  listPrTargets,
  listPrTemplates,
} from "@/serverFunctions/digitalPr";

export const prQueryKey = (projectId: string) => ["digital-pr", projectId];

export function gapSetupOptions(projectId: string) {
  return queryOptions({
    queryKey: [...prQueryKey(projectId), "gap-setup"],
    queryFn: () => getGapSetup({ data: { projectId } }),
  });
}

type GapDomainFilters = Omit<
  Parameters<typeof getCompetitorGap>[0]["data"],
  "projectId"
>;

export function gapRunOptions(projectId: string, filters: GapDomainFilters) {
  return queryOptions({
    queryKey: [...prQueryKey(projectId), "gap", filters],
    queryFn: () => getCompetitorGap({ data: { projectId, ...filters } }),
    placeholderData: keepPreviousData,
  });
}

export type GapRunData = Awaited<ReturnType<typeof getCompetitorGap>>;
export type GapDomain = GapRunData["domains"][number];

export function mediaOverviewOptions(projectId: string) {
  return queryOptions({
    queryKey: [...prQueryKey(projectId), "media-overview"],
    queryFn: () => getMediaOverview({ data: { projectId } }),
  });
}

export type OutletFilters = Omit<
  Parameters<typeof listMediaOutlets>[0]["data"],
  "projectId"
>;

export function mediaOutletsOptions(projectId: string, filters: OutletFilters) {
  return queryOptions({
    queryKey: [...prQueryKey(projectId), "outlets", filters],
    queryFn: () => listMediaOutlets({ data: { projectId, ...filters } }),
    placeholderData: keepPreviousData,
  });
}

export type MediaOutlet = Awaited<
  ReturnType<typeof listMediaOutlets>
>["outlets"][number];
export type MediaContact = MediaOutlet["contacts"][number];

export type TargetFilters = Omit<
  Parameters<typeof listPrTargets>[0]["data"],
  "projectId"
>;

export function prTargetsOptions(projectId: string, filters: TargetFilters) {
  return queryOptions({
    queryKey: [...prQueryKey(projectId), "targets", filters],
    queryFn: () => listPrTargets({ data: { projectId, ...filters } }),
    placeholderData: keepPreviousData,
  });
}

export type PrTarget = Awaited<
  ReturnType<typeof listPrTargets>
>["targets"][number];

export function prTemplatesOptions(projectId: string) {
  return queryOptions({
    queryKey: [...prQueryKey(projectId), "templates"],
    queryFn: () => listPrTemplates({ data: { projectId } }),
  });
}

export type PrTemplate = Awaited<ReturnType<typeof listPrTemplates>>[number];
