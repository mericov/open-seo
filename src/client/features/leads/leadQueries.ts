import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import {
  getLeadSearch,
  listLeadSearches,
  listLeadTemplates,
  listProjectLeads,
} from "@/serverFunctions/leads";

export const leadsQueryKey = (projectId: string) => ["leads", projectId];

// A request cut off on its way back (a deploy swapping the Worker, an expired
// Access session) resolves with no body. Throwing lets the query retry instead
// of failing at once, so a passing blip never reaches the screen.
async function withData<T>(request: Promise<T>): Promise<T> {
  const data = await request;
  if (data === undefined) throw new Error("Empty response");
  return data;
}

export function leadSearchesOptions(projectId: string) {
  return queryOptions({
    queryKey: [...leadsQueryKey(projectId), "searches"],
    queryFn: () => withData(listLeadSearches({ data: { projectId } })),
  });
}

export function leadSearchOptions(projectId: string, searchId: string) {
  return queryOptions({
    queryKey: [...leadsQueryKey(projectId), "search", searchId],
    queryFn: () => withData(getLeadSearch({ data: { projectId, searchId } })),
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
    queryFn: () =>
      withData(listProjectLeads({ data: { projectId, ...filters } })),
    placeholderData: keepPreviousData,
  });
}

export type ProjectLeadRow = Awaited<
  ReturnType<typeof listProjectLeads>
>["leads"][number];

export type LeadSearchDetailData = Awaited<ReturnType<typeof getLeadSearch>>;
export type LeadRow = LeadSearchDetailData["leads"][number];
