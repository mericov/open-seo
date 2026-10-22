import { z } from "zod";
import { dataforseoPost } from "@/server/lib/dataforseo/core";
import {
  assertOk,
  buildTaskBilling,
  parseTaskItems,
  type DataforseoApiResponse,
} from "@/server/lib/dataforseo/envelope";

const bulkTrafficItemSchema = z
  .object({
    target: z.string().nullable().optional(),
    metrics: z
      .object({
        organic: z
          .object({ etv: z.number().nullable().optional() })
          .passthrough()
          .nullable()
          .optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export async function fetchBulkTrafficEstimation(input: {
  targets: string[];
  locationCode: number;
  languageCode: string;
}): Promise<DataforseoApiResponse<{ target: string; etv: number | null }[]>> {
  const response = await dataforseoPost(
    "/v3/dataforseo_labs/google/bulk_traffic_estimation/live",
    [
      {
        targets: input.targets,
        location_code: input.locationCode,
        language_code: input.languageCode,
        item_types: ["organic"],
      },
    ],
  );
  const task = assertOk(response);
  const items = parseTaskItems(
    "bulk-traffic-estimation-live",
    task,
    bulkTrafficItemSchema,
  );
  return {
    data: items.flatMap((item) =>
      item.target
        ? [{ target: item.target, etv: item.metrics?.organic?.etv ?? null }]
        : [],
    ),
    billing: buildTaskBilling(task),
  };
}
