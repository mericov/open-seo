import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/client/components/EmptyState";
import { QueryError } from "@/client/components/QueryState";
import { SafeExternalLink } from "@/client/components/SafeExternalLink";
import { SkeletonPage } from "@/client/components/SkeletonPresets";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { FilterSelect } from "@/client/features/leads/AllLeadsControls";
import {
  FloatingBar,
  formatCompact,
  Pager,
  toggleInSet,
} from "@/client/features/digital-pr/PrControls";
import {
  gapRunOptions,
  prQueryKey,
  type GapDomain,
} from "@/client/features/digital-pr/prQueries";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  addGapDomainsToList,
  setGapDomainsHidden,
} from "@/serverFunctions/digitalPr";
const PAGE_SIZE = 50;
const SPAM_OPTIONS = ["30", "60", "any"] as const;

export function GapResults({
  projectId,
  runId,
}: {
  projectId: string;
  runId: string;
}) {
  const { t, i18n } = useTranslation("digitalPr");
  const queryClient = useQueryClient();
  const [minCompetitors, setMinCompetitors] = useState("1");
  const [spam, setSpam] = useState<(typeof SPAM_OPTIONS)[number]>("30");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const query = useQuery(
    gapRunOptions(projectId, {
      runId,
      minCompetitors: Number(minCompetitors),
      maxSpam: spam === "any" ? null : Number(spam),
      page,
      pageSize: PAGE_SIZE,
    }),
  );

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: prQueryKey(projectId) });

  const addMutation = useMutation({
    mutationFn: (ids: string[]) =>
      addGapDomainsToList({ data: { projectId, runId, gapDomainIds: ids } }),
    onSuccess: async (result) => {
      toast.success(
        t("common.addedToList", {
          count: result.added,
          skipped: result.skipped,
        }),
      );
      setSelected(new Set());
      await refresh();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const hideMutation = useMutation({
    mutationFn: (input: { ids: string[]; hidden: boolean }) =>
      setGapDomainsHidden({
        data: {
          projectId,
          runId,
          gapDomainIds: input.ids,
          hidden: input.hidden,
        },
      }),
    onSuccess: async (_result, input) => {
      setSelected(new Set());
      await refresh();
      if (!input.hidden) return;
      toast.success(t("common.hidden", { count: input.ids.length }), {
        action: {
          label: t("common.undo"),
          onClick: () => hideMutation.mutate({ ids: input.ids, hidden: false }),
        },
      });
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  if (query.isPending) return <SkeletonPage />;
  if (query.isError) {
    return (
      <QueryError
        error={query.error}
        fallback={t("common.loadFailed")}
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
      />
    );
  }

  const data = query.data;
  const competitorOptions = data.competitors.map((_, index) =>
    String(index + 1),
  );
  const pageIds = data.domains.map((row) => row.id);
  const allSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {data.competitors.map((competitor) => (
          <Badge key={competitor.id} variant="outline">
            {competitor.domain}
            <span className="ml-1 tabular-nums opacity-60">
              {competitor.referringDomains}
            </span>
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          value={minCompetitors}
          options={competitorOptions}
          label={(value) =>
            value === "1"
              ? t("gap.minCompetitorsAny")
              : t("gap.minCompetitors", { count: Number(value) })
          }
          onChange={(value) => {
            setMinCompetitors(value);
            setPage(1);
            setSelected(new Set());
          }}
        />
        <FilterSelect
          value={spam}
          options={SPAM_OPTIONS}
          label={(value) =>
            value === "any"
              ? t("gap.spamAny")
              : t("gap.spamMax", { score: value })
          }
          onChange={(value) => {
            setSpam(value);
            setPage(1);
            setSelected(new Set());
          }}
        />
      </div>

      {data.domains.length === 0 ? (
        <EmptyState
          kind="filtered"
          title={t("gap.noResults")}
          description={t("gap.noResultsDescription")}
        />
      ) : (
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
                    {t("gap.columns.domain")}
                  </th>
                  <th className="py-3 pr-4 font-normal">
                    {t("gap.columns.rank")}
                  </th>
                  <th className="py-3 pr-4 font-normal">
                    {t("gap.columns.linksTo")}
                  </th>
                  <th className="py-3 pr-4 text-right font-normal">
                    {t("gap.columns.action")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.domains.map((row) => (
                  <GapRow
                    key={row.id}
                    row={row}
                    locale={i18n.language}
                    selected={selected.has(row.id)}
                    onSelect={(value) =>
                      setSelected((current) =>
                        toggleInSet(current, row.id, value),
                      )
                    }
                    adding={addMutation.isPending}
                    onAdd={() => addMutation.mutate([row.id])}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            page={data.page}
            pageSize={data.pageSize}
            shown={data.domains.length}
            total={data.total}
            onPage={(next) => {
              setPage(next);
              setSelected(new Set());
            }}
          />
        </>
      )}

      {selected.size > 0 ? (
        <FloatingBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
        >
          <Button
            size="sm"
            className="rounded-full"
            pending={addMutation.isPending}
            onClick={() => addMutation.mutate([...selected])}
          >
            <ListPlus data-icon="inline-start" />
            {t("common.addToList")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            pending={hideMutation.isPending}
            onClick={() =>
              hideMutation.mutate({ ids: [...selected], hidden: true })
            }
          >
            <EyeOff data-icon="inline-start" />
            {t("common.hide")}
          </Button>
        </FloatingBar>
      ) : null}
    </div>
  );
}

function GapRow({
  row,
  locale,
  selected,
  onSelect,
  adding,
  onAdd,
}: {
  row: GapDomain;
  locale: string;
  selected: boolean;
  onSelect: (value: boolean) => void;
  adding: boolean;
  onAdd: () => void;
}) {
  const { t } = useTranslation("digitalPr");
  return (
    <tr
      className="border-t border-border/60 transition-colors hover:bg-muted/30 data-[selected=true]:bg-muted/40"
      data-selected={selected}
    >
      <td className="w-10 py-3 pr-0 pl-4 align-top">
        <Checkbox
          checked={selected}
          onCheckedChange={(value) => onSelect(value)}
          aria-label={t("common.selectRow", { name: row.domain })}
        />
      </td>
      <td className="max-w-80 py-3 pr-4 pl-3 align-top">
        <SafeExternalLink
          url={`https://${row.domain}/`}
          label={row.domain}
          className="inline-flex items-center gap-1 font-medium hover:underline"
        />
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("gap.backlinks", { count: row.backlinks })}
          {row.spamScore != null ? (
            <>
              <span className="mx-1.5 opacity-40">·</span>
              {t("gap.spam", { score: row.spamScore })}
            </>
          ) : null}
        </p>
      </td>
      <td className="py-3 pr-4 align-top tabular-nums">
        {formatCompact(row.rank, locale)}
      </td>
      <td className="max-w-80 py-3 pr-4 align-top">
        <div className="flex flex-wrap gap-1">
          {row.competitors.map((competitor) => (
            <span
              key={competitor.domain}
              className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground"
            >
              {competitor.domain}
              <span className="ml-1 tabular-nums opacity-60">
                {competitor.backlinks}
              </span>
            </span>
          ))}
        </div>
      </td>
      <td className="py-3 pr-4 text-right align-top">
        {row.inList ? (
          <Badge variant="success">{t("common.inList")}</Badge>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={adding}
            onClick={onAdd}
          >
            <ListPlus data-icon="inline-start" />
            {t("common.addToList")}
          </Button>
        )}
        {row.inPool && !row.inList ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("gap.inPool")}
          </p>
        ) : null}
      </td>
    </tr>
  );
}
