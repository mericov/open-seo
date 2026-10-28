import { queryOptions } from "@tanstack/react-query";
import {
  getShopifyConnection,
  getShopifyOverview,
  listShopifyThemes,
} from "@/serverFunctions/shopify";

export const shopifyQueryKey = (projectId: string) => ["shopify", projectId];

export const shopifyConnectionOptions = (projectId: string) =>
  queryOptions({
    queryKey: [...shopifyQueryKey(projectId), "connection"],
    queryFn: () => getShopifyConnection({ data: { projectId } }),
  });

export const shopifyOverviewOptions = (projectId: string) =>
  queryOptions({
    queryKey: [...shopifyQueryKey(projectId), "overview"],
    queryFn: () => getShopifyOverview({ data: { projectId } }),
    staleTime: 5 * 60_000,
  });

export const shopifyThemesOptions = (projectId: string) =>
  queryOptions({
    queryKey: [...shopifyQueryKey(projectId), "themes"],
    queryFn: () => listShopifyThemes({ data: { projectId } }),
  });

export function formatShopifyDate(value: string, language: string) {
  return new Date(value).toLocaleDateString(language, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
