import { useState } from "react";
import { Area, AreaChart } from "recharts";
import { useTranslation } from "react-i18next";
import {
  ChartGrid,
  ChartXAxis,
  ChartYAxis,
} from "@/client/components/ChartAxes";
import { Checkbox } from "@/client/components/ui/checkbox";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/client/components/ui/chart";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/client/components/ui/toggle-group";
import {
  TRAFFIC_KINDS,
  TRAFFIC_POSITION_GROUPS,
  type TrafficKind,
  type TrafficPositionGroup,
} from "@/shared/trafficHistory";
import {
  formatCompact,
  formatMonth,
  positionGroupTotals,
  type TrafficMonth,
} from "./trafficHistoryUtils";

export function KeywordPositionsChart({ months }: { months: TrafficMonth[] }) {
  const { t } = useTranslation("trafficHistory");
  const [kind, setKind] = useState<TrafficKind>("organic");
  const [hidden, setHidden] = useState<Set<TrafficPositionGroup>>(new Set());

  const config = Object.fromEntries(
    TRAFFIC_POSITION_GROUPS.map((group, index) => [
      group.key,
      {
        label: t(`keywords.groups.${group.key}`),
        color: `var(--chart-${index + 1})`,
      },
    ]),
  ) satisfies ChartConfig;
  const data = months.map((row) => ({
    month: row.month,
    ...positionGroupTotals(row, kind),
  }));
  const shownGroups = TRAFFIC_POSITION_GROUPS.filter(
    (group) => !hidden.has(group.key),
  );

  const toggle = (key: TrafficPositionGroup, checked: boolean) =>
    setHidden((current) => {
      const next = new Set(current);
      if (checked) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h3 className="text-sm font-semibold">{t("keywords.title")}</h3>
        <ToggleGroup
          size="sm"
          spacing={0.5}
          value={[kind]}
          onValueChange={(next) => {
            const value = TRAFFIC_KINDS.find((option) => option === next[0]);
            if (value) setKind(value);
          }}
          className="rounded-lg bg-muted p-0.5 ring-1 ring-border ring-inset"
        >
          {TRAFFIC_KINDS.map((option) => (
            <ToggleGroupItem
              key={option}
              value={option}
              className="h-6 text-muted-foreground aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm"
            >
              {t(`keywords.${option}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {TRAFFIC_POSITION_GROUPS.map((group) => (
          <label
            key={group.key}
            className="flex cursor-pointer items-center gap-1.5 text-sm"
          >
            <Checkbox
              checked={!hidden.has(group.key)}
              onCheckedChange={(checked) => toggle(group.key, checked)}
            />
            <span
              className="size-2.5 rounded-sm"
              style={{ background: config[group.key].color }}
            />
            {config[group.key].label}
          </label>
        ))}
      </div>
      <ChartContainer
        config={config}
        className="mt-3 h-64 w-full"
        aria-label={t("keywords.title")}
      >
        <AreaChart
          data={data}
          margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
        >
          <ChartGrid />
          <ChartXAxis dataKey="month" tickFormatter={formatTick} />
          <ChartYAxis tickFormatter={formatTick} width={48} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const month = payload?.[0]?.payload?.month;
                  return typeof month === "string"
                    ? formatMonth(month, "long")
                    : "";
                }}
              />
            }
          />
          {shownGroups.map((group) => (
            <Area
              key={group.key}
              type="monotone"
              dataKey={group.key}
              stackId="positions"
              stroke={`var(--color-${group.key})`}
              fill={`var(--color-${group.key})`}
              fillOpacity={0.6}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </section>
  );
}

function formatTick(value: unknown) {
  if (typeof value === "number") return formatCompact(value);
  if (typeof value === "string") return formatMonth(value);
  return "";
}
