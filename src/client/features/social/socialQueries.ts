import { queryOptions } from "@tanstack/react-query";
import {
  getBrandKit,
  getMetaConnection,
  getSocialContext,
  listSocialMedia,
} from "@/serverFunctions/social";

export const socialQueryKey = (projectId: string) => ["social", projectId];

export const metaConnectionOptions = (projectId: string) =>
  queryOptions({
    queryKey: [...socialQueryKey(projectId), "meta"],
    queryFn: () => getMetaConnection({ data: { projectId } }),
  });

export const brandKitOptions = (projectId: string) =>
  queryOptions({
    queryKey: [...socialQueryKey(projectId), "brandKit"],
    queryFn: () => getBrandKit({ data: { projectId } }),
  });

export const socialContextOptions = (projectId: string) =>
  queryOptions({
    queryKey: [...socialQueryKey(projectId), "context"],
    queryFn: () => getSocialContext({ data: { projectId, refresh: false } }),
    staleTime: 10 * 60_000,
  });

export const socialMediaOptions = (projectId: string) =>
  queryOptions({
    queryKey: [...socialQueryKey(projectId), "media"],
    queryFn: () => listSocialMedia({ data: { projectId } }),
  });

export function formatSocialDate(
  value: string,
  language: string,
  timeZone?: string,
) {
  return new Date(value).toLocaleString(language, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}
