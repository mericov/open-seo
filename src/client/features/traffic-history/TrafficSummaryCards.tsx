import { useTranslation } from "react-i18next";
import { cn } from "cn";
import { HelpLabel } from "@/client/components/HelpLabel";
import type { TrafficHistoryData } from "./trafficHistoryQueries";
import {
  formatCompact,
  formatMonth,
  percentChange,
  type TrafficMonth,
} from "./trafficHistoryUtils";

type Props = {
  months: TrafficMonth[];
  backlinks: TrafficHistoryData["backlinks"];
};

type MetricKey =
  | "organicTraffic"
  | "paidTraffic"
  | "organicKeywords"
  | "paidKeywords";

const TREND_METRICS: MetricKey[] = [
  "organicTraffic",
  "paidTraffic",
  "organicKeywords",
  "paidKeywords",
];

export function TrafficSummaryCards({ months, backlinks }: Props) {
  const { t } = useTranslation("trafficHistory");
  const last = months.at(-1);
  const previous = months.at(-2);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {last
        ? TREND_METRICS.map((key) => (
            <SummaryCard
              key={key}
              label={t(`cards.${key}`)}
              value={formatCompact(last[key])}
              change={percentChange(last[key], previous?.[key])}
              changeLabel={
                previous
                  ? t("cards.vsPrevious", {
                      month: formatMonth(previous.month),
                    })
                  : null
              }
            />
          ))
        : null}
      <SummaryCard
        label={t("cards.referringDomains")}
        value={formatCompact(backlinks?.referringDomains)}
      />
      <SummaryCard
        label={t("cards.backlinks")}
        value={formatCompact(backlinks?.backlinks)}
      />
      <SummaryCard
        label={
          <HelpLabel
            label={t("cards.domainRank")}
            helpText={t("cards.domainRankHelp")}
          />
        }
        value={
          backlinks?.domainRank != null ? String(backlinks.domainRank) : "—"
        }
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  change,
  changeLabel,
}: {
  label: React.ReactNode;
  value: string;
  change?: number | null;
  changeLabel?: string | null;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {change != null ? (
        <div className="mt-0.5 text-xs">
          <span
            className={cn(
              "font-medium tabular-nums",
              change >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {change >= 0 ? "+" : ""}
            {change.toFixed(1)}%
          </span>{" "}
          <span className="text-muted-foreground">{changeLabel}</span>
        </div>
      ) : null}
    </div>
  );
}
