import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ShoppingBag } from "lucide-react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { CardShell } from "@/client/components/CardShell";
import { percentChange } from "@/client/components/MetricsTable";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/client/components/ui/chart";
import { Skeleton } from "@/client/components/ui/skeleton";
import { moreDetailsClass } from "@/client/features/dashboard/cardParts";
import {
  shopifyConnectionOptions,
  shopifyOverviewOptions,
} from "@/client/features/shopify/shopifyQueries";
import { cn } from "cn";

function formatDay(date: string, language: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(language, {
    month: "short",
    day: "numeric",
  });
}

function Stat({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: number | null;
}) {
  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p
        className={cn(
          "mt-0.5 text-xs tabular-nums text-muted-foreground",
          change !== null && change > 0 && "text-emerald-600",
          change !== null && change < 0 && "text-destructive",
        )}
      >
        {change === null ? " " : `${change > 0 ? "+" : ""}${change}%`}
      </p>
    </div>
  );
}

export function ShopifyDashboardCard({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation("shopify");
  const connectionQuery = useQuery(shopifyConnectionOptions(projectId));
  const connected = connectionQuery.data?.connected === true;
  const overviewQuery = useQuery({
    ...shopifyOverviewOptions(projectId),
    enabled: connected,
  });

  if (!connected) return null;

  const overview = overviewQuery.data;
  const language = i18n.language;
  const count = (value: number | null) =>
    value === null ? "—" : value.toLocaleString(language);
  const money = (value: number | null, currency: string | null) =>
    value === null
      ? "—"
      : currency
        ? value.toLocaleString(language, {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
          })
        : value.toLocaleString(language);

  const chartConfig = {
    sessions: { label: t("dashboard.sessions"), color: "var(--color-primary)" },
  } satisfies ChartConfig;

  return (
    <CardShell
      title={
        overview?.connected && overview.shopName
          ? overview.shopName
          : t("dashboard.title")
      }
      icon={<ShoppingBag className="size-4" />}
      action={
        <Link
          to="/p/$projectId/shopify"
          params={{ projectId }}
          className={moreDetailsClass}
        >
          {t("dashboard.manage")}
        </Link>
      }
    >
      {overviewQuery.isError ? (
        <p className="text-sm text-muted-foreground">
          {t("dashboard.loadError")}
        </p>
      ) : !overview ? (
        <div className="space-y-3" aria-busy>
          <div className="grid gap-3 sm:grid-cols-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-28" />
        </div>
      ) : !overview.connected ? null : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("dashboard.period", { days: overview.periodDays })} ·{" "}
            {t("dashboard.vsPrevious", { days: overview.periodDays })}
            {overview.productCount !== null
              ? ` · ${t("dashboard.products", { count: overview.productCount })}`
              : ""}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label={t("dashboard.sessions")}
              value={count(overview.totals.sessions)}
              change={percentChange(
                overview.totals.sessions,
                overview.prevTotals.sessions,
              )}
            />
            <Stat
              label={t("dashboard.orders")}
              value={count(overview.totals.orders)}
              change={percentChange(
                overview.totals.orders,
                overview.prevTotals.orders,
              )}
            />
            <Stat
              label={t("dashboard.sales")}
              value={money(overview.totals.totalSales, overview.currencyCode)}
              change={percentChange(
                overview.totals.totalSales,
                overview.prevTotals.totalSales,
              )}
            />
            <Stat
              label={t("dashboard.conversion")}
              value={
                overview.totals.sessions && overview.totals.orders !== null
                  ? `${((overview.totals.orders / overview.totals.sessions) * 100).toFixed(2)}%`
                  : "—"
              }
              change={null}
            />
          </div>
          {overview.analyticsError ? (
            <p className="text-sm text-muted-foreground">
              {t("dashboard.analyticsUnavailable")}
            </p>
          ) : overview.daily.length > 1 ? (
            <ChartContainer config={chartConfig} className="h-32 w-full">
              <AreaChart
                data={overview.daily}
                margin={{ left: 0, right: 0, top: 4, bottom: 0 }}
              >
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={32}
                  tickFormatter={(value: string) => formatDay(value, language)}
                />
                <YAxis hide />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label: unknown) =>
                        typeof label === "string"
                          ? formatDay(label, language)
                          : ""
                      }
                    />
                  }
                />
                <Area
                  dataKey="sessions"
                  type="monotone"
                  stroke="var(--color-sessions)"
                  fill="var(--color-sessions)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          ) : null}
        </div>
      )}
    </CardShell>
  );
}
