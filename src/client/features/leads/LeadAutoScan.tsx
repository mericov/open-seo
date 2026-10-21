import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Switch } from "@/client/components/ui/switch";
import { leadsQueryKey } from "@/client/features/leads/leadQueries";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { formatRelativeTime } from "@/client/lib/relative-time";
import { runLeadSearchNow, setLeadSchedule } from "@/serverFunctions/leads";
import { LEAD_RUN_SIZE_MAX } from "@/shared/leadScan";

export function LeadAutoScan({
  projectId,
  search,
}: {
  projectId: string;
  search: {
    id: string;
    autoRun: boolean;
    runSize: number;
    nextRunAt: string | null;
    lastRunAt: string | null;
  };
}) {
  const { t } = useTranslation("leads");
  const queryClient = useQueryClient();
  const [runSize, setRunSize] = useState(search.runSize);
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: leadsQueryKey(projectId) });

  const scheduleMutation = useMutation({
    mutationFn: (input: { autoRun: boolean; runSize: number }) =>
      setLeadSchedule({ data: { projectId, searchId: search.id, ...input } }),
    onSuccess: invalidate,
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });
  const runMutation = useMutation({
    mutationFn: () =>
      runLeadSearchNow({ data: { projectId, searchId: search.id } }),
    onSuccess: async (result) => {
      toast.success(t("scan.ranNow", { count: result.added }));
      await invalidate();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const saveRunSize = () => {
    const size = Math.min(LEAD_RUN_SIZE_MAX, Math.max(1, runSize || 1));
    setRunSize(size);
    if (size !== search.runSize) {
      scheduleMutation.mutate({ autoRun: search.autoRun, runSize: size });
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <RefreshCw className="mt-0.5 size-4 text-muted-foreground" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{t("scan.autoTitle")}</p>
          <p className="text-xs text-muted-foreground">
            {search.autoRun && search.nextRunAt
              ? t("scan.nextRun", {
                  when: formatRelativeTime(search.nextRunAt),
                })
              : t("scan.autoHint")}
            {search.lastRunAt
              ? ` · ${t("scan.lastRun", { when: formatRelativeTime(search.lastRunAt) })}`
              : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <Switch
            checked={search.autoRun}
            disabled={scheduleMutation.isPending}
            onCheckedChange={(value) =>
              scheduleMutation.mutate({ autoRun: value, runSize })
            }
          />
          {t("scan.weekly")}
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          {t("scan.perRun")}
          <Input
            type="number"
            min={1}
            max={LEAD_RUN_SIZE_MAX}
            value={runSize}
            onChange={(event) => setRunSize(Number(event.target.value))}
            onBlur={saveRunSize}
            className="h-8 w-16"
          />
        </label>
        <Button
          size="sm"
          variant="outline"
          pending={runMutation.isPending}
          onClick={() => runMutation.mutate()}
        >
          <Play data-icon="inline-start" />
          {t("scan.runNow", { count: search.runSize })}
        </Button>
      </div>
    </div>
  );
}
