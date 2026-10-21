import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/client/components/EmptyState";
import { ExportMenu } from "@/client/components/ExportMenu";
import { QueryError } from "@/client/components/QueryState";
import { SkeletonPage } from "@/client/components/SkeletonPresets";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Switch } from "@/client/components/ui/switch";
import { AllLeadsRow } from "@/client/features/leads/AllLeadsRow";
import {
  BulkBar,
  FilterSelect,
} from "@/client/features/leads/AllLeadsControls";
import {
  leadsQueryKey,
  projectLeadsOptions,
  type ProjectLeadFilters,
} from "@/client/features/leads/leadQueries";
import { exportRows, type ExportFormat } from "@/client/lib/exportRows";
import { listProjectLeads, setLeadStatus } from "@/serverFunctions/leads";
import {
  LEAD_OUTREACH_STATUSES,
  type LeadOutreachStatus,
} from "@/shared/leadFindings";
import { LEAD_LIST_MAX_PAGE_SIZE } from "@/types/schemas/leads";
import { cn } from "cn";

const PAGE_SIZE = 50;
const SOURCES = ["any", "local", "shopify"] as const;
const MIN_SCORES = ["any", "30", "50", "70"] as const;
type StatusTab = LeadOutreachStatus | "all";

export function AllLeadsView({ projectId }: { projectId: string }) {
  const { t } = useTranslation("leads");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusTab>("all");
  const [source, setSource] = useState<(typeof SOURCES)[number]>("any");
  const [minScore, setMinScore] = useState<(typeof MIN_SCORES)[number]>("any");
  const [hasEmail, setHasEmail] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filters: ProjectLeadFilters = {
    status: status === "all" ? undefined : status,
    source: source === "any" ? undefined : source,
    minScore: minScore === "any" ? undefined : Number(minScore),
    hasEmail: hasEmail || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const leadsQuery = useQuery(projectLeadsOptions(projectId, filters));

  const resetPaging = () => {
    setPage(1);
    setSelected(new Set());
  };

  const statusMutation = useMutation({
    mutationFn: (input: { leadIds: string[]; status: LeadOutreachStatus }) =>
      setLeadStatus({ data: { projectId, ...input } }),
    onSuccess: async (result) => {
      toast.success(t("all.updated", { count: result.updated }));
      setSelected(new Set());
      await queryClient.invalidateQueries({
        queryKey: leadsQueryKey(projectId),
      });
    },
  });

  const onExport = async (format: ExportFormat) => {
    const all = await listProjectLeads({
      data: {
        projectId,
        ...filters,
        page: 1,
        pageSize: LEAD_LIST_MAX_PAGE_SIZE,
      },
    });
    await exportRows({
      format,
      feature: "lead_finder",
      headers: [
        "name",
        "score",
        "gaps",
        "email",
        "phone",
        "website",
        "instagram",
        "facebook",
        "linkedin",
        "whatsapp",
        "status",
        "emailed_at",
        "search",
        "country",
        "products",
        "rating",
        "reviews",
      ],
      rows: all.leads.map((lead) => [
        lead.name,
        lead.opportunityScore,
        lead.findings.map((code) => t(`findings.${code}`)).join(", "),
        lead.primaryEmail,
        lead.phone,
        lead.website,
        lead.instagramUrl,
        lead.facebookUrl,
        lead.linkedinUrl,
        lead.whatsappUrl,
        t(`outreach.${lead.outreachStatus}`),
        lead.contactedAt?.slice(0, 10) ?? null,
        lead.searchLabel,
        lead.countryCode,
        lead.productCount,
        lead.rating,
        lead.reviewsCount,
      ]),
      filename: "leads-all",
    });
  };

  const data = leadsQuery.data;
  const pageIds = data?.leads.map((lead) => lead.id) ?? [];
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-muted p-1"
        >
          {(["all", ...LEAD_OUTREACH_STATUSES] as StatusTab[]).map((key) => (
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
              {t(`outreach.${key}`)}
              <span className="text-xs tabular-nums opacity-60">
                {data?.counts[key] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={source}
            options={SOURCES}
            label={(value) =>
              value === "any"
                ? t("all.sourceAll")
                : value === "local"
                  ? t("all.sourceLocal")
                  : t("all.sourceShopify")
            }
            onChange={(value) => {
              setSource(value);
              resetPaging();
            }}
          />
          <FilterSelect
            value={minScore}
            options={MIN_SCORES}
            label={(value) =>
              value === "any"
                ? t("all.minScoreAll")
                : t("all.minScore", { score: value })
            }
            onChange={(value) => {
              setMinScore(value);
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
            {t("all.hasEmail")}
          </label>
          <ExportMenu
            actions={["csv", "sheets", "copy-json"]}
            onExport={(format) => void onExport(format)}
          />
        </div>
      </div>

      {leadsQuery.isPending ? (
        <SkeletonPage />
      ) : leadsQuery.isError ? (
        <QueryError
          error={leadsQuery.error}
          fallback={t("detail.loadFailed")}
          onRetry={() => void leadsQuery.refetch()}
          isRetrying={leadsQuery.isFetching}
        />
      ) : data && data.leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("all.empty")}
          description={t("all.emptyDescription")}
        />
      ) : data ? (
        <>
          <div className="overflow-x-auto rounded-2xl border border-border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="w-10 py-3 pr-0 pl-4 font-normal">
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={(value) =>
                        setSelected(
                          value === true ? new Set(pageIds) : new Set(),
                        )
                      }
                      aria-label={t("all.selectAll")}
                    />
                  </th>
                  <th className="py-3 pr-4 pl-3 font-normal">
                    {t("all.columns.lead")}
                  </th>
                  <th className="py-3 pr-4 font-normal">
                    {t("all.columns.score")}
                  </th>
                  <th className="py-3 pr-4 font-normal">
                    {t("all.columns.gaps")}
                  </th>
                  <th className="py-3 pr-4 font-normal">
                    {t("all.columns.email")}
                  </th>
                  <th className="py-3 pr-4 text-right font-normal">
                    {t("all.columns.status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.leads.map((lead) => (
                  <AllLeadsRow
                    key={lead.id}
                    lead={lead}
                    selected={selected.has(lead.id)}
                    onSelect={(value) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (value) next.add(lead.id);
                        else next.delete(lead.id);
                        return next;
                      })
                    }
                    onStatus={(next) =>
                      statusMutation.mutate({
                        leadIds: [lead.id],
                        status: next,
                      })
                    }
                    statusPending={statusMutation.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="tabular-nums">
              {t("all.range", {
                from: (data.page - 1) * data.pageSize + 1,
                to: (data.page - 1) * data.pageSize + data.leads.length,
                total: data.total,
              })}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => {
                  setPage(page - 1);
                  setSelected(new Set());
                }}
              >
                {t("all.previous")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page * PAGE_SIZE >= data.total}
                onClick={() => {
                  setPage(page + 1);
                  setSelected(new Set());
                }}
              >
                {t("all.next")}
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {selected.size > 0 ? (
        <BulkBar
          count={selected.size}
          pending={statusMutation.isPending}
          onStatus={(next) =>
            statusMutation.mutate({ leadIds: [...selected], status: next })
          }
          onClear={() => setSelected(new Set())}
        />
      ) : null}
    </div>
  );
}
