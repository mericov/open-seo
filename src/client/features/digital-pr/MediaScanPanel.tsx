import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pause, Play, Plus, Radar, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Switch } from "@/client/components/ui/switch";
import { FilterSelect } from "@/client/features/leads/AllLeadsControls";
import {
  mediaOverviewOptions,
  prQueryKey,
} from "@/client/features/digital-pr/prQueries";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { formatRelativeTime } from "@/client/lib/relative-time";
import {
  addMediaTopics,
  deleteMediaTopic,
  enrichMediaBatch,
  runMediaScan,
  setMediaSchedule,
} from "@/serverFunctions/digitalPr";
import { PR_MARKETS, type PrMarket } from "@/shared/digitalPr";

export function MediaScanPanel({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation("digitalPr");
  const queryClient = useQueryClient();
  const overviewQuery = useQuery(mediaOverviewOptions(projectId));
  const [topicText, setTopicText] = useState("");
  const [market, setMarket] = useState<PrMarket>("tr");
  const [paused, setPaused] = useState(false);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: prQueryKey(projectId) });

  const addMutation = useMutation({
    mutationFn: () =>
      addMediaTopics({
        data: {
          projectId,
          market,
          keywords: topicText
            .split(/[,\n]+/)
            .map((value) => value.trim())
            .filter((value) => value.length >= 2),
        },
      }),
    onSuccess: async () => {
      setTopicText("");
      await refresh();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (topicId: string) =>
      deleteMediaTopic({ data: { projectId, topicId } }),
    onSuccess: refresh,
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const scheduleMutation = useMutation({
    mutationFn: (autoRun: boolean) =>
      setMediaSchedule({ data: { projectId, autoRun } }),
    onSuccess: refresh,
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const scanMutation = useMutation({
    mutationFn: () => runMediaScan({ data: { projectId } }),
    onSuccess: async (result) => {
      setPaused(false);
      toast.success(
        t("media.scanDone", {
          outlets: result.outletsAdded,
          articles: result.articlesAdded,
        }),
      );
      await refresh();
    },
    onError: async (error) => {
      toast.error(getStandardErrorMessage(error));
      await refresh();
    },
  });

  const enrichMutation = useMutation({
    mutationFn: () => enrichMediaBatch({ data: { projectId } }),
    onSuccess: refresh,
  });

  const overview = overviewQuery.data;
  const pendingTotal = overview
    ? overview.pending.outlets + overview.pending.articles
    : 0;
  const canEnrich =
    pendingTotal > 0 &&
    !paused &&
    !scanMutation.isPending &&
    !enrichMutation.isPending &&
    !enrichMutation.isError &&
    !overviewQuery.isFetching;
  const { mutate: enrich } = enrichMutation;
  useEffect(() => {
    if (canEnrich) enrich();
  }, [canEnrich, enrich]);

  if (!overview) return null;
  const running = overview.running || scanMutation.isPending;
  const lastRun = overview.runs[0];

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-semibold">{t("media.topicsTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("media.topicsDescription")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={overview.autoRun}
              disabled={scheduleMutation.isPending}
              onCheckedChange={(value) => scheduleMutation.mutate(value)}
            />
            {t("media.weekly")}
          </label>
          <Button
            pending={running}
            disabled={overview.topics.length === 0}
            onClick={() => scanMutation.mutate()}
          >
            <Radar data-icon="inline-start" />
            {running ? t("media.scanning") : t("media.scanNow")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {overview.topics.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("media.noTopics")}</p>
        ) : (
          overview.topics.map((topic) => (
            <span
              key={topic.id}
              className="inline-flex items-center gap-1 rounded-full border border-border py-0.5 pr-1 pl-2.5 text-xs"
            >
              <span className="font-medium uppercase opacity-60">
                {topic.market}
              </span>
              {topic.keyword}
              <button
                type="button"
                aria-label={t("media.removeTopic", { topic: topic.keyword })}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => deleteMutation.mutate(topic.id)}
              >
                <X className="size-3" />
              </button>
            </span>
          ))
        )}
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (topicText.trim().length >= 2) addMutation.mutate();
        }}
      >
        <Input
          value={topicText}
          onChange={(event) => setTopicText(event.target.value)}
          placeholder={t("media.topicPlaceholder")}
          className="min-w-56 flex-1"
        />
        <FilterSelect
          value={market}
          options={PR_MARKETS}
          label={(value) => t(`markets.${value}`)}
          onChange={setMarket}
        />
        <Button
          type="submit"
          variant="outline"
          pending={addMutation.isPending}
          disabled={topicText.trim().length < 2}
        >
          <Plus data-icon="inline-start" />
          {t("media.addTopic")}
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        {lastRun ? (
          <span>
            {t("media.lastRun", {
              when: formatRelativeTime(lastRun.startedAt),
              outlets: lastRun.outletsAdded,
              articles: lastRun.articlesAdded,
            })}
            {lastRun.status === "failed" ? (
              <Badge variant="destructive" className="ml-2">
                {t("media.runFailed")}
              </Badge>
            ) : null}
          </span>
        ) : (
          <span>{t("media.neverRun")}</span>
        )}
        {overview.autoRun && overview.nextRunAt ? (
          <span>
            {t("media.nextRun", {
              date: new Date(overview.nextRunAt).toLocaleDateString(
                i18n.language,
                { day: "numeric", month: "short" },
              ),
            })}
          </span>
        ) : null}
        {pendingTotal > 0 ? (
          <span className="inline-flex items-center gap-2">
            {paused ? null : <Loader2 className="size-3 animate-spin" />}
            {t("media.reading", {
              outlets: overview.pending.outlets,
              articles: overview.pending.articles,
            })}
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setPaused(!paused);
                enrichMutation.reset();
              }}
            >
              {paused ? (
                <Play data-icon="inline-start" />
              ) : (
                <Pause data-icon="inline-start" />
              )}
              {paused ? t("media.resume") : t("media.pause")}
            </Button>
          </span>
        ) : null}
        {enrichMutation.isError ? (
          <span className="text-destructive">
            {getStandardErrorMessage(enrichMutation.error)}
          </span>
        ) : null}
      </div>
    </section>
  );
}
