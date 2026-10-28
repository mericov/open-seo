import { useState } from "react";
import { Line, LineChart, ReferenceLine } from "recharts";
import { Download, StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ChartGrid,
  ChartXAxis,
  ChartYAxis,
} from "@/client/components/ChartAxes";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/client/components/ui/chart";
import { buildCsv } from "@/client/lib/csv";
import { downloadFile } from "@/client/lib/download";
import type { TrafficHistoryData } from "./trafficHistoryQueries";
import {
  formatCompact,
  formatMonth,
  type TrafficMonth,
} from "./trafficHistoryUtils";

const SERIES = ["organicTraffic", "paidTraffic"] as const;
type Series = (typeof SERIES)[number];

type Props = {
  domain: string;
  months: TrafficMonth[];
  notes: TrafficHistoryData["notes"];
  onAddNote: () => void;
};

export function TrafficChart({ domain, months, notes, onAddNote }: Props) {
  const { t } = useTranslation("trafficHistory");
  const [visible, setVisible] = useState<Record<Series, boolean>>({
    organicTraffic: true,
    paidTraffic: true,
  });
  const config = {
    organicTraffic: { label: t("traffic.organic"), color: "var(--chart-1)" },
    paidTraffic: { label: t("traffic.paid"), color: "var(--chart-2)" },
  } satisfies ChartConfig;
  const shown = SERIES.filter((key) => visible[key]);
  const monthSet = new Set(months.map((row) => row.month));
  const visibleNotes = notes.filter((note) => monthSet.has(note.month));

  const exportCsv = () => {
    const csv = buildCsv(
      [t("csv.month"), ...shown.map((key) => config[key].label)],
      months.map((row) => [
        row.month,
        ...shown.map((key) => {
          const value = row[key];
          return value == null ? null : Math.round(value);
        }),
      ]),
    );
    downloadFile(csv, `${domain}-traffic.csv`, "text/csv");
  };

  return (
    <section className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h3 className="text-sm font-semibold">{t("traffic.title")}</h3>
        {SERIES.map((key) => (
          <label
            key={key}
            className="flex cursor-pointer items-center gap-1.5 text-sm"
          >
            <Checkbox
              checked={visible[key]}
              onCheckedChange={(checked) =>
                setVisible((current) => ({ ...current, [key]: checked }))
              }
            />
            <span
              className="size-2.5 rounded-full"
              style={{ background: config[key].color }}
            />
            {config[key].label}
          </label>
        ))}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={onAddNote}>
            <StickyNote />
            {t("notes.add")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={months.length === 0 || shown.length === 0}
          >
            <Download />
            {t("traffic.export")}
          </Button>
        </div>
      </div>
      {months.length === 0 ? (
        <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">
          {t("traffic.empty")}
        </p>
      ) : (
        <ChartContainer
          config={config}
          className="mt-3 h-64 w-full"
          aria-label={t("traffic.title")}
        >
          <LineChart
            data={months}
            margin={{ left: 4, right: 8, top: 16, bottom: 0 }}
          >
            <ChartGrid />
            <ChartXAxis dataKey="month" tickFormatter={formatTick} />
            <ChartYAxis tickFormatter={formatTick} width={48} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    formatTooltipLabel(payload, notes)
                  }
                  valueFormatter={(value) =>
                    typeof value === "number"
                      ? Math.round(value).toLocaleString()
                      : String(value)
                  }
                />
              }
            />
            {visibleNotes.map((note, index) => (
              <ReferenceLine
                key={note.id}
                x={note.month}
                stroke="var(--muted-foreground)"
                strokeDasharray="3 3"
                label={{
                  value: String(index + 1),
                  position: "top",
                  fontSize: 10,
                  fill: "var(--muted-foreground)",
                }}
              />
            ))}
            {shown.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={`var(--color-${key})`}
                strokeWidth={2}
                dot={months.length <= 2}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      )}
      {visibleNotes.length > 0 ? (
        <ol className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {visibleNotes.map((note, index) => (
            <li key={note.id}>
              <span className="font-medium text-foreground">
                {index + 1}. {formatMonth(note.month)}
              </span>{" "}
              {note.body}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function formatTick(value: unknown) {
  if (typeof value === "number") return formatCompact(value);
  if (typeof value === "string") return formatMonth(value);
  return "";
}

function formatTooltipLabel(
  payload: readonly { payload?: unknown }[] | undefined,
  notes: TrafficHistoryData["notes"],
) {
  const row = payload?.[0]?.payload;
  if (!row || typeof row !== "object" || !("month" in row)) return "";
  const month = String(row.month);
  const monthNotes = notes.filter((note) => note.month === month);
  return (
    <div>
      <div>{formatMonth(month, "long")}</div>
      {monthNotes.map((note) => (
        <div key={note.id} className="font-normal text-muted-foreground">
          {note.body}
        </div>
      ))}
    </div>
  );
}
