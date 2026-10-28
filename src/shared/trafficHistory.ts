export const TRAFFIC_POSITION_BANDS = [
  "pos_1",
  "pos_2_3",
  "pos_4_10",
  "pos_11_20",
  "pos_21_30",
  "pos_31_40",
  "pos_41_50",
  "pos_51_60",
  "pos_61_70",
  "pos_71_80",
  "pos_81_90",
  "pos_91_100",
] as const;

export type TrafficPositionBand = (typeof TRAFFIC_POSITION_BANDS)[number];

export const TRAFFIC_KINDS = ["organic", "paid"] as const;

export type TrafficKind = (typeof TRAFFIC_KINDS)[number];

export const TRAFFIC_POSITION_GROUPS = [
  { key: "top3", bands: ["pos_1", "pos_2_3"] },
  { key: "pos4to10", bands: ["pos_4_10"] },
  { key: "pos11to20", bands: ["pos_11_20"] },
  { key: "pos21to50", bands: ["pos_21_30", "pos_31_40", "pos_41_50"] },
  {
    key: "pos51to100",
    bands: ["pos_51_60", "pos_61_70", "pos_71_80", "pos_81_90", "pos_91_100"],
  },
] as const satisfies readonly {
  key: string;
  bands: readonly TrafficPositionBand[];
}[];

export type TrafficPositionGroup =
  (typeof TRAFFIC_POSITION_GROUPS)[number]["key"];

export const TRAFFIC_RANGES = ["1m", "6m", "1y", "2y", "all"] as const;

export type TrafficRange = (typeof TRAFFIC_RANGES)[number];

export const TRAFFIC_EXTEND_RANGES = ["2y", "all"] as const;

export type TrafficExtendRange = (typeof TRAFFIC_EXTEND_RANGES)[number];

const TRAFFIC_HISTORY_EARLIEST_MONTH = "2020-10";

export const TRAFFIC_HISTORY_DEFAULT_MONTHS = 6;

const HISTORICAL_RANK_TASK_USD = 0.12;
const HISTORICAL_RANK_MONTH_USD = 0.0012;

const REFRESH_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function estimateHistoricalRankUsd(months: number) {
  return HISTORICAL_RANK_TASK_USD + months * HISTORICAL_RANK_MONTH_USD;
}

export function currentMonth(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function addMonths(month: string, delta: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));
  return currentMonth(date);
}

export function monthsBetween(from: string, to: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

export function extendTargetMonth(range: TrafficExtendRange, now = new Date()) {
  return range === "all"
    ? TRAFFIC_HISTORY_EARLIEST_MONTH
    : addMonths(currentMonth(now), -23);
}

export function rangeStartMonth(range: TrafficRange, latestMonth: string) {
  if (range === "all") return TRAFFIC_HISTORY_EARLIEST_MONTH;
  const span = { "1m": 1, "6m": 5, "1y": 11, "2y": 23 }[range];
  return addMonths(latestMonth, -span);
}

export function canRefreshTrafficHistory(
  latestMonth: string | null,
  lastFetchedAt: string,
  now = new Date(),
) {
  if (latestMonth != null && latestMonth >= currentMonth(now)) return false;
  return (
    now.getTime() - new Date(lastFetchedAt).getTime() > REFRESH_COOLDOWN_MS
  );
}
