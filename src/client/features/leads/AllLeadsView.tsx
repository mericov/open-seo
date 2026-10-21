import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Mail, Users } from "lucide-react";
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
import { LeadTemplatesSheet } from "@/client/features/leads/LeadTemplatesSheet";
import { localToday } from "@/client/features/leads/LeadNote";
import { MailButton } from "@/client/features/leads/MailButton";
import { useLeadActions } from "@/client/features/leads/useLeadActions";
import { useMailClient } from "@/client/features/leads/useMailClient";
import {
  BulkBar,
  FilterSelect,
} from "@/client/features/leads/AllLeadsControls";
import {
  leadTemplatesOptions,
  projectLeadsOptions,
  type ProjectLeadFilters,
} from "@/client/features/leads/leadQueries";
import { exportAllLeads } from "@/client/features/leads/leadExport";
import type { ExportFormat } from "@/client/lib/exportRows";
import {
  LEAD_OUTREACH_STATUSES,
  type LeadOutreachStatus,
} from "@/shared/leadFindings";
import { LEAD_FIRST_LINE_MAX_IDS } from "@/types/schemas/leads";
import { cn } from "cn";

const PAGE_SIZE = 50;
const SOURCES = ["any", "local", "shopify"] as const;
const MIN_SCORES = ["any", "30", "50", "70"] as const;
type StatusTab = LeadOutreachStatus | "all";

export function AllLeadsView({ projectId }: { projectId: string }) {
  const { t } = useTranslation("leads");
  const [status, setStatus] = useState<StatusTab>("all");
  const [source, setSource] = useState<(typeof SOURCES)[number]>("any");
  const [minScore, setMinScore] = useState<(typeof MIN_SCORES)[number]>("any");
  const [hasEmail, setHasEmail] = useState(false);
  const [dueOnly, setDueOnly] = useState(false);
  const today = localToday();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filters: ProjectLeadFilters = {
    status: status === "all" ? undefined : status,
    source: source === "any" ? undefined : source,
    minScore: minScore === "any" ? undefined : Number(minScore),
    hasEmail: hasEmail || undefined,
    dueBy: dueOnly ? today : undefined,
    today,
    page,
    pageSize: PAGE_SIZE,
  };
  const leadsQuery = useQuery(projectLeadsOptions(projectId, filters));
  const templatesQuery = useQuery(leadTemplatesOptions(projectId));
  const [mailClient, setMailClient] = useMailClient();
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const resetPaging = () => {
    setPage(1);
    setSelected(new Set());
  };

  const actions = useLeadActions(projectId, () => setSelected(new Set()));
  const statusMutation = actions.status;
  const linesMutation = actions.lines;

  const onExport = (format: ExportFormat) =>
    exportAllLeads(projectId, filters, format, t);

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
            {t("notes.due", { count: data?.counts.due ?? 0 })}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setTemplatesOpen(true)}
          >
            <Mail data-icon="inline-start" />
            {t("templates.title")}
          </Button>
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
                    projectId={projectId}
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
                    mail={
                      <MailButton
                        lead={lead}
                        templates={templatesQuery.data ?? []}
                        mailClient={mailClient}
                        onOpened={() => {
                          if (lead.outreachStatus === "new") {
                            statusMutation.mutate({
                              leadIds: [lead.id],
                              status: "contacted",
                            });
                          }
                        }}
                      />
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
          hiding={actions.hide.isPending}
          onHide={() =>
            actions.hide.mutate({ leadIds: [...selected], hidden: true })
          }
          count={selected.size}
          pending={statusMutation.isPending}
          writingLines={linesMutation.isPending}
          onWriteLines={() => {
            if (selected.size > LEAD_FIRST_LINE_MAX_IDS) {
              toast.error(
                t("firstLine.tooMany", { max: LEAD_FIRST_LINE_MAX_IDS }),
              );
              return;
            }
            linesMutation.mutate([...selected]);
          }}
          onStatus={(next) =>
            statusMutation.mutate({ leadIds: [...selected], status: next })
          }
          onClear={() => setSelected(new Set())}
        />
      ) : null}
      <LeadTemplatesSheet
        projectId={projectId}
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        mailClient={mailClient}
        onMailClientChange={setMailClient}
      />
    </div>
  );
}
