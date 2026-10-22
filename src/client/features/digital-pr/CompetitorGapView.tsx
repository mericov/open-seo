import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitCompareArrows, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/client/components/EmptyState";
import { QueryError } from "@/client/components/QueryState";
import { SkeletonPage } from "@/client/components/SkeletonPresets";
import { Button } from "@/client/components/ui/button";
import { Field, FieldLabel } from "@/client/components/ui/field";
import { Textarea } from "@/client/components/ui/textarea";
import { FilterSelect } from "@/client/features/leads/AllLeadsControls";
import {
  gapSetupOptions,
  prQueryKey,
} from "@/client/features/digital-pr/prQueries";
import { GapResults } from "@/client/features/digital-pr/GapResults";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { formatRelativeTime } from "@/client/lib/relative-time";
import {
  deleteCompetitorGap,
  runCompetitorGap,
} from "@/serverFunctions/digitalPr";
import { PR_GAP_MAX_COMPETITORS } from "@/shared/digitalPr";
function parseCompetitors(text: string) {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

export function CompetitorGapView({ projectId }: { projectId: string }) {
  const { t } = useTranslation("digitalPr");
  const queryClient = useQueryClient();
  const setupQuery = useQuery(gapSetupOptions(projectId));
  const [competitorText, setCompetitorText] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  const setup = setupQuery.data;
  const activeRunId = runId ?? setup?.runs[0]?.id ?? null;
  const text = competitorText ?? setup?.suggested.join("\n") ?? "";
  const competitors = parseCompetitors(text);

  const runMutation = useMutation({
    mutationFn: () => runCompetitorGap({ data: { projectId, competitors } }),
    onSuccess: async (result) => {
      toast.success(t("gap.done", { count: result.total }));
      setRunId(result.runId);
      await queryClient.invalidateQueries({ queryKey: prQueryKey(projectId) });
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      deleteCompetitorGap({ data: { projectId, runId: id } }),
    onSuccess: async () => {
      setRunId(null);
      await queryClient.invalidateQueries({ queryKey: prQueryKey(projectId) });
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  if (setupQuery.isPending) return <SkeletonPage />;
  if (setupQuery.isError) {
    return (
      <QueryError
        error={setupQuery.error}
        fallback={t("common.loadFailed")}
        onRetry={() => void setupQuery.refetch()}
        isRetrying={setupQuery.isFetching}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 md:p-5">
        <div className="space-y-1">
          <h2 className="font-semibold">{t("gap.setupTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {setupQuery.data.ownDomain
              ? t("gap.setupDescription", { domain: setupQuery.data.ownDomain })
              : t("gap.noDomain")}
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="gap-competitors">
            {t("gap.competitors", { max: PR_GAP_MAX_COMPETITORS })}
          </FieldLabel>
          <Textarea
            id="gap-competitors"
            rows={4}
            placeholder={t("gap.competitorsPlaceholder")}
            value={text}
            onChange={(event) => setCompetitorText(event.target.value)}
            className="font-mono text-sm"
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            pending={runMutation.isPending}
            disabled={
              !setupQuery.data.ownDomain ||
              competitors.length === 0 ||
              competitors.length > PR_GAP_MAX_COMPETITORS
            }
            onClick={() => runMutation.mutate()}
          >
            <Play data-icon="inline-start" />
            {t("gap.run")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {competitors.length > PR_GAP_MAX_COMPETITORS
              ? t("gap.tooMany", { max: PR_GAP_MAX_COMPETITORS })
              : t("gap.runHint")}
          </p>
        </div>
      </section>

      {setupQuery.data.runs.length === 0 || !activeRunId ? (
        <EmptyState
          icon={GitCompareArrows}
          title={t("gap.emptyTitle")}
          description={t("gap.emptyDescription")}
        />
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FilterSelect
              value={activeRunId}
              options={setupQuery.data.runs.map((run) => run.id)}
              label={(id) => {
                const run = setupQuery.data.runs.find((row) => row.id === id);
                return run
                  ? t("gap.runLabel", {
                      when: formatRelativeTime(run.createdAt),
                      count: run.totalDomains,
                    })
                  : id;
              }}
              onChange={setRunId}
            />
            <Button
              size="sm"
              variant="ghost"
              pending={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(activeRunId)}
            >
              <Trash2 data-icon="inline-start" />
              {t("gap.deleteRun")}
            </Button>
          </div>
          <GapResults
            key={activeRunId}
            projectId={projectId}
            runId={activeRunId}
          />
        </section>
      )}
    </div>
  );
}
