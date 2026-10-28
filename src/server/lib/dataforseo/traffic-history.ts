import { z } from "zod";
import { dataforseoPost } from "@/server/lib/dataforseo/core";
import {
  assertOk,
  buildTaskBilling,
  parseTaskItems,
  type DataforseoApiResponse,
} from "@/server/lib/dataforseo/envelope";

const nullableNumber = z.number().nullable().optional();

const rankMetricsSchema = z
  .object({
    etv: nullableNumber,
    count: nullableNumber,
    estimated_paid_traffic_cost: nullableNumber,
    pos_1: nullableNumber,
    pos_2_3: nullableNumber,
    pos_4_10: nullableNumber,
    pos_11_20: nullableNumber,
    pos_21_30: nullableNumber,
    pos_31_40: nullableNumber,
    pos_41_50: nullableNumber,
    pos_51_60: nullableNumber,
    pos_61_70: nullableNumber,
    pos_71_80: nullableNumber,
    pos_81_90: nullableNumber,
    pos_91_100: nullableNumber,
  })
  .passthrough();

const metricsSchema = z
  .object({
    organic: rankMetricsSchema.nullable().optional(),
    paid: rankMetricsSchema.nullable().optional(),
  })
  .passthrough();

const historicalItemSchema = z
  .object({
    year: z.number(),
    month: z.number(),
    metrics: metricsSchema.nullable().optional(),
  })
  .passthrough();

const locationItemSchema = z
  .object({
    location_code: z.number().nullable().optional(),
    language_code: z.string().nullable().optional(),
    metrics: metricsSchema.nullable().optional(),
  })
  .passthrough();

export type HistoricalRankItem = z.infer<typeof historicalItemSchema>;
type LocationRankItem = z.infer<typeof locationItemSchema>;

export async function fetchHistoricalRankOverview(input: {
  target: string;
  locationCode: number;
  languageCode: string;
  dateFrom?: string;
  dateTo?: string;
  expectedMonths: number;
}): Promise<DataforseoApiResponse<HistoricalRankItem[]>> {
  const response = await dataforseoPost(
    "/v3/dataforseo_labs/google/historical_rank_overview/live",
    [
      {
        target: input.target,
        location_code: input.locationCode,
        language_code: input.languageCode,
        date_from: input.dateFrom,
        date_to: input.dateTo,
      },
    ],
  );
  const task = assertOk(response);
  return {
    data: parseTaskItems(
      "historical-rank-overview-live",
      task,
      historicalItemSchema,
    ),
    billing: buildTaskBilling(task),
  };
}

export async function fetchDomainRankByLocation(input: {
  target: string;
  limit: number;
}): Promise<DataforseoApiResponse<LocationRankItem[]>> {
  const response = await dataforseoPost(
    "/v3/dataforseo_labs/google/domain_rank_overview/live",
    [{ target: input.target, limit: input.limit }],
  );
  const task = assertOk(response);
  return {
    data: parseTaskItems(
      "domain-rank-overview-by-location-live",
      task,
      locationItemSchema,
    ),
    billing: buildTaskBilling(task),
  };
}
