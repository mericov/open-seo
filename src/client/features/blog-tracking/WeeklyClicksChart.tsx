import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/client/components/ui/chart";
import { formatNumber } from "@/i18n/format";
import { getCurrentLocale } from "@/i18n/config";

export function formatWeek(weekStart: string) {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString(
    getCurrentLocale(),
    { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" },
  );
}

export function WeeklyClicksChart({
  weeks,
  className = "h-28",
}: {
  weeks: { weekStart: string; clicks: number }[];
  className?: string;
}) {
  const { t } = useTranslation("blogTracking");
  const config = {
    clicks: { label: t("columns.clicks"), color: "var(--color-primary)" },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className={className}>
      <AreaChart data={weeks} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="weekStart" hide />
        <YAxis hide domain={[0, "auto"]} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label: unknown) =>
                typeof label === "string"
                  ? t("trend.weekOf", { week: formatWeek(label) })
                  : ""
              }
              valueFormatter={(value) => formatNumber(Number(value))}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="clicks"
          stroke="var(--color-clicks)"
          strokeWidth={2}
          fill="var(--color-clicks)"
          fillOpacity={0.08}
        />
      </AreaChart>
    </ChartContainer>
  );
}
