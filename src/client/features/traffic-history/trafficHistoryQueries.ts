import { queryOptions } from "@tanstack/react-query";
import { getTrafficHistory } from "@/serverFunctions/trafficHistory";

export function trafficHistoryKey(
  projectId: string,
  domain: string,
  locationCode: number,
) {
  return ["traffic-history", projectId, domain, locationCode] as const;
}

export function trafficHistoryOptions(
  projectId: string,
  domain: string,
  locationCode: number,
) {
  return queryOptions({
    queryKey: trafficHistoryKey(projectId, domain, locationCode),
    queryFn: () =>
      getTrafficHistory({ data: { projectId, domain, locationCode } }),
  });
}

export type TrafficHistoryData = Awaited<ReturnType<typeof getTrafficHistory>>;
