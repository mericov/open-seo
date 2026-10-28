import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Info, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { LocationSelect } from "@/client/components/LocationSelect";
import { QueryError } from "@/client/components/QueryState";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Card } from "@/client/components/ui/card";
import { Spinner } from "@/client/components/ui/spinner";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/client/components/ui/toggle-group";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { formatRelativeTime } from "@/client/lib/relative-time";
import {
  addTrafficNote,
  deleteTrafficNote,
  ensureTrafficHistory,
  extendTrafficHistory,
  refreshTrafficHistory,
} from "@/serverFunctions/trafficHistory";
import { LABS_LOCATION_OPTIONS } from "@/shared/keyword-locations";
import {
  TRAFFIC_EXTEND_RANGES,
  TRAFFIC_HISTORY_DEFAULT_MONTHS,
  TRAFFIC_RANGES,
  canRefreshTrafficHistory,
  currentMonth,
  estimateHistoricalRankUsd,
  extendTargetMonth,
  monthsBetween,
  rangeStartMonth,
  type TrafficExtendRange,
  type TrafficRange,
} from "@/shared/trafficHistory";
import { CountryDistribution, useCountryNames } from "./CountryDistribution";
import { KeywordPositionsChart } from "./KeywordPositionsChart";
import { SerpPositionsDonut } from "./SerpPositionsDonut";
import { TrafficChart } from "./TrafficChart";
import { TrafficNotesDialog } from "./TrafficNotesDialog";
import { TrafficSummaryCards } from "./TrafficSummaryCards";
import {
  trafficHistoryKey,
  trafficHistoryOptions,
  type TrafficHistoryData,
} from "./trafficHistoryQueries";
import { filterByRange, formatMonth, formatUsd } from "./trafficHistoryUtils";

type Props = {
  projectId: string;
  domain: string;
  defaultLocationCode: number;
};

export function TrafficHistorySection({
  projectId,
  domain,
  defaultLocationCode,
}: Props) {
  const { t } = useTranslation("trafficHistory");
  const queryClient = useQueryClient();
  const countryNames = useCountryNames();
  const [locationCode, setLocationCode] = useState(defaultLocationCode);
  const [range, setRange] = useState<TrafficRange>("all");
  const [offerRange, setOfferRange] = useState<TrafficRange | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const autoRequested = useRef(false);

  const query = useQuery(
    trafficHistoryOptions(projectId, domain, locationCode),
  );
  const view = query.data;
  const market = { projectId, domain, locationCode };

  const applyView = async (next: TrafficHistoryData) => {
    queryClient.setQueryData(
      trafficHistoryKey(projectId, domain, next.locationCode),
      next,
    );
    await queryClient.invalidateQueries({
      queryKey: ["traffic-history", projectId, domain],
      predicate: (entry) => entry.queryKey[3] !== next.locationCode,
    });
  };
  const onError = (error: unknown) =>
    toast.error(getStandardErrorMessage(error));

  const ensureMutation = useMutation({
    mutationFn: () => ensureTrafficHistory({ data: market }),
    onSuccess: applyView,
    onError,
  });
  const refreshMutation = useMutation({
    mutationFn: () => refreshTrafficHistory({ data: market }),
    onSuccess: async (next) => {
      await applyView(next);
      toast.success(t("refreshed"));
    },
    onError,
  });
  const extendMutation = useMutation({
    mutationFn: (extendRange: TrafficExtendRange) =>
      extendTrafficHistory({ data: { ...market, range: extendRange } }),
    onSuccess: async (next) => {
      await applyView(next);
      setOfferRange(null);
      toast.success(t("extend.done"));
    },
    onError,
  });
  const addNoteMutation = useMutation({
    mutationFn: (input: { month: string; body: string }) =>
      addTrafficNote({ data: { ...market, ...input } }),
    onSuccess: async (next) => {
      await applyView(next);
      toast.success(t("notes.saved"));
    },
    onError,
  });
  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) =>
      deleteTrafficNote({ data: { ...market, noteId } }),
    onSuccess: async (next) => {
      await applyView(next);
      toast.success(t("notes.deleted"));
    },
    onError,
  });

  const needsAutoFetch =
    view != null && view.fetch == null && locationCode === defaultLocationCode;
  useEffect(() => {
    if (!needsAutoFetch || autoRequested.current) return;
    autoRequested.current = true;
    ensureMutation.mutate();
  }, [needsAutoFetch, ensureMutation]);

  const countryName = countryNames.get(locationCode) ?? String(locationCode);
  const months = view?.months ?? [];
  const latestMonth = months.at(-1)?.month ?? null;
  const visibleMonths = filterByRange(months, range);

  const selectRange = (next: TrafficRange) => {
    setRange(next);
    const coveredFrom = view?.fetch?.coveredFrom;
    const start = rangeStartMonth(next, latestMonth ?? currentMonth());
    setOfferRange(
      coveredFrom && next !== "1m" && next !== "6m" && coveredFrom > start
        ? next
        : null,
    );
  };

  const refreshBlockedReason = view?.fetch
    ? canRefreshTrafficHistory(latestMonth, view.fetch.lastFetchedAt)
      ? null
      : latestMonth != null && latestMonth >= currentMonth()
        ? t("refreshUpToDate")
        : t("refreshCooldown")
    : null;

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-start gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <History className="size-4" />
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LocationSelect
            value={locationCode}
            onChange={(code) => {
              setLocationCode(code);
              setOfferRange(null);
            }}
            options={LABS_LOCATION_OPTIONS}
            className="w-48"
          />
          {view?.fetch ? (
            <>
              <span className="text-xs text-muted-foreground">
                {t("lastFetched", {
                  time: formatRelativeTime(view.fetch.lastFetchedAt),
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                pending={refreshMutation.isPending}
                disabled={refreshBlockedReason != null}
                title={refreshBlockedReason ?? undefined}
                onClick={() => refreshMutation.mutate()}
              >
                <RefreshCw />
                {t("refresh")}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 px-4 pb-4">
        {query.isError ? (
          <QueryError
            error={query.error}
            fallback={t("title")}
            onRetry={() => void query.refetch()}
            isRetrying={query.isFetching}
          />
        ) : !view ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <>
            {months.length > 0 || view.backlinks ? (
              <TrafficSummaryCards months={months} backlinks={view.backlinks} />
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
              <div className="space-y-4">
                <CountryDistribution
                  countries={view.countries}
                  activeLocationCode={locationCode}
                  onSelect={(code) => {
                    setLocationCode(code);
                    setOfferRange(null);
                  }}
                />
                {months.length > 0 ? (
                  <SerpPositionsDonut month={months[months.length - 1]} />
                ) : null}
              </div>

              <div className="min-w-0 space-y-4">
                {view.fetch == null ? (
                  <FetchPrompt
                    loading={ensureMutation.isPending}
                    countryName={countryName}
                    onFetch={() => ensureMutation.mutate()}
                  />
                ) : months.length === 0 ? (
                  <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
                    {t("noMonths", { country: countryName })}
                  </p>
                ) : (
                  <>
                    <ToggleGroup
                      size="sm"
                      spacing={0.5}
                      value={[range]}
                      onValueChange={(next) => {
                        const value = TRAFFIC_RANGES.find(
                          (option) => option === next[0],
                        );
                        if (value) selectRange(value);
                      }}
                      className="rounded-lg bg-muted p-0.5 ring-1 ring-border ring-inset"
                    >
                      {TRAFFIC_RANGES.map((option) => (
                        <ToggleGroupItem
                          key={option}
                          value={option}
                          className="h-6 text-muted-foreground aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm"
                        >
                          {t(`ranges.${option}`)}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>

                    {offerRange && view.fetch ? (
                      <ExtendOffer
                        coveredFrom={view.fetch.coveredFrom}
                        pendingRange={
                          extendMutation.isPending
                            ? extendMutation.variables
                            : null
                        }
                        onExtend={(extendRange) =>
                          extendMutation.mutate(extendRange)
                        }
                      />
                    ) : null}

                    <TrafficChart
                      domain={view.domain}
                      months={visibleMonths}
                      notes={view.notes}
                      onAddNote={() => setNotesOpen(true)}
                    />
                    <KeywordPositionsChart months={visibleMonths} />
                  </>
                )}
              </div>
            </div>

            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {t("estimatedNote")}
            </p>
          </>
        )}
      </div>

      {notesOpen && view ? (
        <TrafficNotesDialog
          months={months.map((row) => row.month)}
          notes={view.notes}
          saving={addNoteMutation.isPending}
          onSave={(month, body) => addNoteMutation.mutate({ month, body })}
          onDelete={(noteId) => deleteNoteMutation.mutate(noteId)}
          onClose={() => setNotesOpen(false)}
        />
      ) : null}
    </Card>
  );
}

function FetchPrompt({
  loading,
  countryName,
  onFetch,
}: {
  loading: boolean;
  countryName: string;
  onFetch: () => void;
}) {
  const { t } = useTranslation("trafficHistory");
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 rounded-lg border border-border text-sm text-muted-foreground">
        <Spinner />
        {t("loadingAuto")}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-6 text-center">
      <p className="text-sm">
        {t("noDataForCountry", { country: countryName })}
      </p>
      <Button onClick={onFetch}>{t("fetchCountry")}</Button>
      <p className="text-xs text-muted-foreground">
        {t("fetchCost", {
          cost: formatUsd(
            estimateHistoricalRankUsd(TRAFFIC_HISTORY_DEFAULT_MONTHS),
          ),
        })}
      </p>
    </div>
  );
}

function ExtendOffer({
  coveredFrom,
  pendingRange,
  onExtend,
}: {
  coveredFrom: string;
  pendingRange: TrafficExtendRange | null | undefined;
  onExtend: (range: TrafficExtendRange) => void;
}) {
  const { t } = useTranslation("trafficHistory");
  const options = TRAFFIC_EXTEND_RANGES.filter(
    (option) => extendTargetMonth(option) < coveredFrom,
  );

  return (
    <Alert variant="info">
      <Info />
      <AlertDescription className="text-foreground">
        <p className="font-medium">
          {t("extend.title", { from: formatMonth(coveredFrom, "long") })}
        </p>
        <p className="text-muted-foreground">{t("extend.description")}</p>
        <div className="mt-2 flex flex-wrap gap-4">
          {options.map((option) => (
            <div key={option} className="flex flex-col items-start gap-1">
              <Button
                size="sm"
                variant="outline"
                pending={pendingRange === option}
                disabled={pendingRange != null}
                onClick={() => onExtend(option)}
              >
                {t(`extend.${option}`)}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t("extend.cost", {
                  cost: formatUsd(
                    estimateHistoricalRankUsd(
                      monthsBetween(extendTargetMonth(option), coveredFrom),
                    ),
                  ),
                })}
              </span>
            </div>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}
