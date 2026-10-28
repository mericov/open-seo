import { Cell, Pie, PieChart } from "recharts";
import { useTranslation } from "react-i18next";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/client/components/ui/chart";
import { TRAFFIC_POSITION_GROUPS } from "@/shared/trafficHistory";
import {
  formatCompact,
  formatMonth,
  positionGroupTotals,
  type TrafficMonth,
} from "./trafficHistoryUtils";

export function SerpPositionsDonut({ month }: { month: TrafficMonth }) {
  const { t } = useTranslation("trafficHistory");
  const totals = positionGroupTotals(month, "organic");
  const data = TRAFFIC_POSITION_GROUPS.map((group, index) => ({
    key: group.key,
    value: totals[group.key],
    fill: `var(--chart-${index + 1})`,
  }));
  const config = Object.fromEntries(
    data.map((row) => [
      row.key,
      { label: t(`keywords.groups.${row.key}`), color: row.fill },
    ]),
  ) satisfies ChartConfig;
  const total = data.reduce((sum, row) => sum + row.value, 0);

  return (
    <section className="rounded-lg border border-border p-3">
      <h3 className="text-sm font-semibold">{t("serp.title")}</h3>
      <p className="text-xs text-muted-foreground">
        {t("serp.subtitle", { month: formatMonth(month.month, "long") })}
      </p>
      {total === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("serp.empty")}</p>
      ) : (
        <div className="mt-2 flex flex-col items-center gap-3">
          <ChartContainer
            config={config}
            className="aspect-square size-36 shrink-0"
            aria-label={t("serp.title")}
          >
            <PieChart>
              <ChartTooltip
                content={<ChartTooltipContent nameKey="key" hideLabel />}
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="key"
                innerRadius="58%"
                outerRadius="95%"
                strokeWidth={1}
              >
                {data.map((row) => (
                  <Cell key={row.key} fill={row.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="w-full space-y-1 text-sm">
            {data.map((row) => (
              <li key={row.key} className="flex items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ background: row.fill }}
                />
                <span className="flex-1 truncate">
                  {t(`keywords.groups.${row.key}`)}
                </span>
                <span className="tabular-nums">{formatCompact(row.value)}</span>
                <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
                  {((row.value / total) * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
