import { getCurrentLocale } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";
import {
  TRAFFIC_POSITION_GROUPS,
  rangeStartMonth,
  type TrafficKind,
  type TrafficPositionGroup,
  type TrafficRange,
} from "@/shared/trafficHistory";
import type { TrafficHistoryData } from "./trafficHistoryQueries";

export type TrafficMonth = TrafficHistoryData["months"][number];

export function formatMonth(month: string, style: "short" | "long" = "short") {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    month: style,
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthIndex - 1, 1)));
}

export function formatCompact(value: number | null | undefined) {
  if (value == null) return "—";
  return formatNumber(value, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

export function formatUsd(value: number) {
  return formatNumber(value, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function filterByRange(months: TrafficMonth[], range: TrafficRange) {
  const latest = months.at(-1)?.month;
  if (!latest) return [];
  const start = rangeStartMonth(range, latest);
  return months.filter((row) => row.month >= start);
}

export function percentChange(
  current: number | null | undefined,
  previous: number | null | undefined,
) {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function positionGroupTotals(month: TrafficMonth, kind: TrafficKind) {
  const positions =
    kind === "organic" ? month.organicPositions : month.paidPositions;
  const totals: Record<TrafficPositionGroup, number> = {
    top3: 0,
    pos4to10: 0,
    pos11to20: 0,
    pos21to50: 0,
    pos51to100: 0,
  };
  for (const group of TRAFFIC_POSITION_GROUPS) {
    totals[group.key] = group.bands.reduce(
      (sum, band) => sum + (positions[band] ?? 0),
      0,
    );
  }
  return totals;
}
