import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import {
  getLeadSearch,
  listLeadSearches,
  listLeadTemplates,
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

export function leadTemplatesOptions(projectId: string) {
  return queryOptions({
    queryKey: [...leadsQueryKey(projectId), "templates"],
    queryFn: () => listLeadTemplates({ data: { projectId } }),
  });
}

export type LeadTemplate = Awaited<
  ReturnType<typeof listLeadTemplates>
>[number];

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
