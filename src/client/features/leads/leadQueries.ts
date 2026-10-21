import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import {
  getLeadSearch,
  listLeadCategories,
  listLeadSearches,
  listProjectLeads,
} from "@/serverFunctions/leads";

export const leadsQueryKey = (projectId: string) => ["leads", projectId];

export function leadSearchesOptions(projectId: string) {
  return queryOptions({
    queryKey: [...leadsQueryKey(projectId), "searches"],
    queryFn: () => listLeadSearches({ data: { projectId } }),
  });
}

export function leadSearchOptions(projectId: string, searchId: string) {
  return queryOptions({
    queryKey: [...leadsQueryKey(projectId), "search", searchId],
    queryFn: () => getLeadSearch({ data: { projectId, searchId } }),
  });
}

export function leadCategoriesOptions(projectId: string, query: string) {
  return queryOptions({
    queryKey: [...leadsQueryKey(projectId), "categories", query],
    queryFn: () => listLeadCategories({ data: { projectId, query } }),
    enabled: query.trim().length >= 2,
    staleTime: 60 * 60 * 1000,
  });
}

export type ProjectLeadFilters = Omit<
  Parameters<typeof listProjectLeads>[0]["data"],
  "projectId"
>;

export function projectLeadsOptions(
  projectId: string,
  filters: ProjectLeadFilters,
) {
  return queryOptions({
    queryKey: [...leadsQueryKey(projectId), "all", filters],
    queryFn: () => listProjectLeads({ data: { projectId, ...filters } }),
    placeholderData: keepPreviousData,
  });
}

export type ProjectLeadRow = Awaited<
  ReturnType<typeof listProjectLeads>
>["leads"][number];

export type LeadSearchDetailData = Awaited<ReturnType<typeof getLeadSearch>>;
export type LeadRow = LeadSearchDetailData["leads"][number];
