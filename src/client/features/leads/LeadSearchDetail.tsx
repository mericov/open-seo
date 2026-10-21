import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { ExportMenu } from "@/client/components/ExportMenu";
import { QueryError } from "@/client/components/QueryState";
import { SkeletonPage } from "@/client/components/SkeletonPresets";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Progress } from "@/client/components/ui/progress";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import {
  leadSearchOptions,
  leadsQueryKey,
  type LeadRow,
} from "@/client/features/leads/leadQueries";
import { buildLeadExport } from "@/client/features/leads/leadExport";
import { LeadAutoScan } from "@/client/features/leads/LeadAutoScan";
import { LeadTableRow } from "@/client/features/leads/LeadTableRow";
import { exportRows, type ExportFormat } from "@/client/lib/exportRows";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { deleteLeadSearch, enrichLeadBatch } from "@/serverFunctions/leads";
import { LEAD_REACHABILITY_ORDER, type LeadReachability } from "@/shared/leads";

type Filter = LeadReachability | "all";

export function LeadSearchDetail({
  projectId,
  searchId,
}: {
  projectId: string;
  searchId: string;
}) {
  const { t } = useTranslation("leads");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const searchQuery = useQuery(leadSearchOptions(projectId, searchId));
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const enrichMutation = useMutation({
    mutationFn: () => enrichLeadBatch({ data: { projectId, searchId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: leadSearchOptions(projectId, searchId).queryKey,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteLeadSearch({ data: { projectId, searchId } }),
    onSuccess: async () => {
      toast.success(t("detail.deleted"));
      await queryClient.invalidateQueries({
        queryKey: leadsQueryKey(projectId),
      });
      await navigate({
        to: "/p/$projectId/leads",
        params: { projectId },
        search: {},
      });
    },
  });

  const pending = searchQuery.data?.summary.pending ?? 0;
  const canEnrich =
    pending > 0 &&
    !paused &&
    !enrichMutation.isPending &&
    !enrichMutation.isError &&
    !searchQuery.isFetching;
  const { mutate: enrich } = enrichMutation;
  useEffect(() => {
    if (canEnrich) enrich();
  }, [canEnrich, enrich]);

  if (searchQuery.isPending) return <SkeletonPage />;
  if (searchQuery.isError) {
    return (
      <div className="p-6">
        <QueryError
          error={searchQuery.error}
          fallback={t("detail.loadFailed")}
          onRetry={() => void searchQuery.refetch()}
          isRetrying={searchQuery.isFetching}
        />
      </div>
    );
  }

  const { search } = searchQuery.data;
  const isStoreSearch = search.source === "shopify";
  const isHiddenStore = (lead: LeadRow) =>
    isStoreSearch &&
    search.technology === "Shopify" &&
    lead.enrichmentStatus !== "pending" &&
    lead.productCount == null;
  const hiddenStores = searchQuery.data.leads.filter(isHiddenStore).length;
  const trackedLeads = searchQuery.data.leads.filter(
    (lead) => lead.outreachStatus !== "new",
  ).length;
  const leads =
    isStoreSearch && verifiedOnly
      ? searchQuery.data.leads.filter((lead) => !isHiddenStore(lead))
      : searchQuery.data.leads;
  const total = searchQuery.data.leads.length;
  const counts = new Map<Filter, number>([["all", leads.length]]);
  for (const lead of leads) {
    counts.set(lead.reachability, (counts.get(lead.reachability) ?? 0) + 1);
  }
  const done = total - pending;
  const visible =
    filter === "all"
      ? leads
      : leads.filter((lead) => lead.reachability === filter);

  const onExport = (format: ExportFormat) => {
    const { headers, rows } = buildLeadExport(visible, search.source, t);
    void exportRows({
      format,
      feature: "lead_finder",
      headers,
      rows,
      filename: t("export.filename", {
        label: search.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      }),
    });
  };

  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <Link
              to="/p/$projectId/leads"
              params={{ projectId }}
              search={{}}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3" />
              {t("detail.back")}
            </Link>
            <h1 className="text-xl font-semibold tracking-tight">
              {search.label}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isStoreSearch
                ? t("detail.storeScope", {
                    platform: search.technology ?? t("detail.domainList"),
                    keywords: search.keywordQuery ?? t("detail.allKeywords"),
                    country: search.countryCode ?? t("stores.countries.any"),
                  })
                : t("detail.radius", {
                    radius: search.radiusKm,
                    location: search.locationLabel,
                  })}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 data-icon="inline-start" />
            {t("detail.delete")}
          </Button>
        </div>

        {isStoreSearch && hiddenStores > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              {verifiedOnly
                ? t("detail.hiddenStores", { count: hiddenStores })
                : t("detail.shownStores", { count: hiddenStores })}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setVerifiedOnly((value) => !value)}
            >
              {verifiedOnly ? t("detail.showAll") : t("detail.hideUnverified")}
            </Button>
          </div>
        ) : null}

        {!isStoreSearch || search.technology ? (
          <LeadAutoScan projectId={projectId} search={search} />
        ) : null}

        {search.skippedDuplicates > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("detail.skipped", { count: search.skippedDuplicates })}
          </p>
        ) : null}

        {pending > 0 ? (
          <div className="space-y-2 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{t("detail.progressTitle")}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  enrichMutation.reset();
                  setPaused((value) => !value);
                }}
              >
                {paused ? t("detail.resume") : t("detail.pause")}
              </Button>
            </div>
            <Progress value={total === 0 ? 0 : (done / total) * 100} />
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("detail.progress", { done, total })}
            </p>
            {enrichMutation.isError ? (
              <Alert variant="destructive">
                <AlertDescription className="flex flex-wrap items-center gap-2">
                  {getStandardErrorMessage(enrichMutation.error)}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => enrichMutation.reset()}
                  >
                    {t("detail.resume")}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5" role="group">
            {(["all", ...LEAD_REACHABILITY_ORDER] as Filter[])
              .filter((key) => (counts.get(key) ?? 0) > 0 || key === "all")
              .map((key) => (
                <Button
                  key={key}
                  size="sm"
                  variant={filter === key ? "default" : "outline"}
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {key === "all"
                    ? t("detail.filterAll")
                    : t(`reachability.${key}`)}
                  <span className="tabular-nums opacity-70">
                    {counts.get(key) ?? 0}
                  </span>
                </Button>
              ))}
          </div>
          <ExportMenu
            actions={["csv", "sheets", "copy-json"]}
            onExport={onExport}
          />
        </div>

        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.business")}</TableHead>
                <TableHead>{t("table.email")}</TableHead>
                <TableHead>{t("table.contact")}</TableHead>
                <TableHead className="text-right">
                  {isStoreSearch ? t("table.store") : t("table.rating")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {t("detail.noLeads")}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((lead) => (
                  <LeadTableRow
                    key={lead.id}
                    lead={lead}
                    isStore={isStoreSearch}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </TableCard>
      </div>

      {confirmDelete ? (
        <ConfirmDialog
          title={t("detail.deleteTitle")}
          confirmLabel={t("detail.delete")}
          destructive
          pending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate()}
          onClose={() => setConfirmDelete(false)}
        >
          {t("detail.deleteDescription")}
          {trackedLeads > 0 ? (
            <span className="mt-2 block font-medium text-destructive">
              {t("detail.deleteTracked", { count: trackedLeads })}
            </span>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
