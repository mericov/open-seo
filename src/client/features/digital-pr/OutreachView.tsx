import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Mail, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/client/components/EmptyState";
import { QueryError } from "@/client/components/QueryState";
import { SkeletonPage } from "@/client/components/SkeletonPresets";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Switch } from "@/client/components/ui/switch";
import { FilterSelect } from "@/client/features/leads/AllLeadsControls";
import { localToday } from "@/client/features/leads/LeadNote";
import { useMailClient } from "@/client/features/leads/useMailClient";
import {
  FloatingBar,
  Pager,
  toggleInSet,
} from "@/client/features/digital-pr/PrControls";
import { PrStatusMenu } from "@/client/features/digital-pr/PrTargetParts";
import { PrTemplatesSheet } from "@/client/features/digital-pr/PrTemplatesSheet";
import {
  prQueryKey,
  prTargetsOptions,
  prTemplatesOptions,
  type TargetFilters,
} from "@/client/features/digital-pr/prQueries";
import { PrMailButton } from "@/client/features/digital-pr/PrMailButton";
import { PrTargetRow } from "@/client/features/digital-pr/PrTargetRow";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  generatePrPitches,
  markPrTargetSent,
  removePrTargets,
  setPrTargetStatus,
} from "@/serverFunctions/digitalPr";
import {
  PR_TARGET_SOURCES,
  PR_TARGET_STATUSES,
  type PrTargetSource,
  type PrTargetStatus,
} from "@/shared/digitalPr";
import { PR_PITCH_MAX_IDS } from "@/types/schemas/digitalPr";
import { cn } from "cn";
const PAGE_SIZE = 50;
type StatusTab = PrTargetStatus | "all";

export function OutreachView({ projectId }: { projectId: string }) {
  const { t } = useTranslation("digitalPr");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusTab>("all");
  const [source, setSource] = useState<PrTargetSource | "any">("any");
  const [hasEmail, setHasEmail] = useState(false);
  const [dueOnly, setDueOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [mailClient, setMailClient] = useMailClient();
  const today = localToday();

  const filters: TargetFilters = {
    status: status === "all" ? undefined : status,
    source: source === "any" ? undefined : source,
    hasEmail: hasEmail || undefined,
    dueBy: dueOnly ? today : undefined,
    today,
    page,
    pageSize: PAGE_SIZE,
  };
  const targetsQuery = useQuery(prTargetsOptions(projectId, filters));
  const templatesQuery = useQuery(prTemplatesOptions(projectId));

  const resetPaging = () => {
    setPage(1);
    setSelected(new Set());
  };
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: prQueryKey(projectId) });

  const statusMutation = useMutation({
    mutationFn: (input: { targetIds: string[]; status: PrTargetStatus }) =>
      setPrTargetStatus({ data: { projectId, ...input } }),
    onSuccess: async (result) => {
      toast.success(t("outreach.updated", { count: result.updated }));
      setSelected(new Set());
      await refresh();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const sentMutation = useMutation({
    mutationFn: (targetId: string) =>
      markPrTargetSent({ data: { projectId, targetId } }),
    onSuccess: refresh,
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const pitchMutation = useMutation({
    mutationFn: (targetIds: string[]) =>
      generatePrPitches({ data: { projectId, targetIds } }),
    onSuccess: async (result) => {
      toast.success(t("outreach.pitchesWritten", { count: result.written }));
      await refresh();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const removeMutation = useMutation({
    mutationFn: (targetIds: string[]) =>
      removePrTargets({ data: { projectId, targetIds } }),
    onSuccess: async (result) => {
      toast.success(t("outreach.removed", { count: result.removed }));
      setSelected(new Set());
      await refresh();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const data = targetsQuery.data;
  const pageIds = data?.targets.map((target) => target.id) ?? [];
  const allSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-muted p-1"
        >
          {(["all", ...PR_TARGET_STATUSES] as StatusTab[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={status === key}
              onClick={() => {
                setStatus(key);
                resetPaging();
              }}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                status === key && "bg-background text-foreground shadow-sm",
              )}
            >
              {key === "all" ? t("outreach.all") : t(`statuses.${key}`)}
              <span className="text-xs tabular-nums opacity-60">
                {data?.counts[key] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={source}
            options={["any", ...PR_TARGET_SOURCES] as const}
            label={(value) =>
              value === "any" ? t("outreach.sourceAll") : t(`sources.${value}`)
            }
            onChange={(value) => {
              setSource(value);
              resetPaging();
            }}
          />
          <label className="inline-flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <Switch
              checked={hasEmail}
              onCheckedChange={(value) => {
                setHasEmail(value);
                resetPaging();
              }}
            />
            {t("outreach.hasEmail")}
          </label>
          <Button
            size="sm"
            variant={dueOnly ? "default" : "ghost"}
            aria-pressed={dueOnly}
            onClick={() => {
              setDueOnly(!dueOnly);
              resetPaging();
            }}
            className={cn(
              !dueOnly && (data?.counts.due ?? 0) > 0 && "text-destructive",
            )}
          >
            <Bell data-icon="inline-start" />
            {t("outreach.due", { count: data?.counts.due ?? 0 })}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setTemplatesOpen(true)}
          >
            <Mail data-icon="inline-start" />
            {t("templates.title")}
          </Button>
        </div>
      </div>

      {targetsQuery.isPending ? (
        <SkeletonPage />
      ) : targetsQuery.isError ? (
        <QueryError
          error={targetsQuery.error}
          fallback={t("common.loadFailed")}
          onRetry={() => void targetsQuery.refetch()}
          isRetrying={targetsQuery.isFetching}
        />
      ) : data && data.targets.length === 0 ? (
        <EmptyState
          icon={Send}
          title={t("outreach.emptyTitle")}
          description={t("outreach.emptyDescription")}
        />
      ) : data ? (
        <>
          <div className="overflow-x-auto rounded-2xl border border-border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="w-10 py-3 pr-0 pl-4 font-normal">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(value) =>
                        setSelected(value ? new Set(pageIds) : new Set())
                      }
                      aria-label={t("common.selectAll")}
                    />
                  </th>
                  <th className="py-3 pr-4 pl-3 font-normal">
                    {t("outreach.columns.target")}
                  </th>
                  <th className="py-3 pr-4 font-normal">
                    {t("outreach.columns.email")}
                  </th>
                  <th className="py-3 pr-4 text-right font-normal">
                    {t("outreach.columns.status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.targets.map((target) => (
                  <PrTargetRow
                    key={target.id}
                    projectId={projectId}
                    target={target}
                    selected={selected.has(target.id)}
                    onSelect={(value) =>
                      setSelected((current) =>
                        toggleInSet(current, target.id, value),
                      )
                    }
                    mail={
                      <PrMailButton
                        target={target}
                        templates={templatesQuery.data ?? []}
                        project={data.project}
                        mailClient={mailClient}
                        onOpened={() => sentMutation.mutate(target.id)}
                      />
                    }
                    onStatus={(next) =>
                      statusMutation.mutate({
                        targetIds: [target.id],
                        status: next,
                      })
                    }
                    statusPending={statusMutation.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            page={data.page}
            pageSize={data.pageSize}
            shown={data.targets.length}
            total={data.total}
            onPage={(next) => {
              setPage(next);
              setSelected(new Set());
            }}
          />
        </>
      ) : null}

      {selected.size > 0 ? (
        <FloatingBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
        >
          <Button
            size="sm"
            className="rounded-full"
            pending={pitchMutation.isPending}
            onClick={() => {
              if (selected.size > PR_PITCH_MAX_IDS) {
                toast.error(
                  t("outreach.tooManyPitches", { max: PR_PITCH_MAX_IDS }),
                );
                return;
              }
              pitchMutation.mutate([...selected]);
            }}
          >
            <Sparkles data-icon="inline-start" />
            {t("outreach.writePitches")}
          </Button>
          <PrStatusMenu
            disabled={statusMutation.isPending}
            trigger={<span className="text-xs">{t("outreach.setStatus")}</span>}
            onChange={(next) =>
              statusMutation.mutate({ targetIds: [...selected], status: next })
            }
          />
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            pending={removeMutation.isPending}
            onClick={() => removeMutation.mutate([...selected])}
          >
            <Trash2 data-icon="inline-start" />
            {t("outreach.remove")}
          </Button>
        </FloatingBar>
      ) : null}

      <PrTemplatesSheet
        projectId={projectId}
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        mailClient={mailClient}
        onMailClientChange={setMailClient}
      />
    </div>
  );
}
