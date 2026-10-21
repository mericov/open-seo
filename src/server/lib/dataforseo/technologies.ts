import { dataforseoPost } from "@/server/lib/dataforseo/core";
import {
  assertOk,
  buildTaskBilling,
  type DataforseoApiResponse,
  type DataforseoItemsTask,
} from "@/server/lib/dataforseo/envelope";

type DomainTechnologyItem = Record<string, unknown>;

export async function fetchDomainsByTechnology(input: {
  technologies: string[];
  keywords?: string[];
  filters?: unknown[];
  orderBy?: string[];
  limit: number;
  offset?: number;
}): Promise<DataforseoApiResponse<DomainTechnologyItem[]>> {
  const response = await dataforseoPost<
    DataforseoItemsTask<DomainTechnologyItem>
  >("/v3/domain_analytics/technologies/domains_by_technology/live", [
    {
      technologies: input.technologies,
      keywords: input.keywords?.length ? input.keywords : undefined,
      mode: input.keywords?.length ? "entry" : undefined,
      filters: input.filters?.length ? input.filters : undefined,
      order_by: input.orderBy,
      limit: input.limit,
      offset: input.offset || undefined,
    },
  ]);
  const task = assertOk(response, { treatNoResultsAsEmpty: true });
  return {
    data: task.result?.[0]?.items ?? [],
    billing: buildTaskBilling(task),
  };
}
