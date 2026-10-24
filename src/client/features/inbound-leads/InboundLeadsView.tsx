import { useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Check, ChevronDown, Inbox } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { QueryError } from "@/client/components/QueryState";
import { SkeletonPageContent } from "@/client/components/SkeletonPresets";
import { Button } from "@/client/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import { InboundLeadCard } from "@/client/features/inbound-leads/InboundLeadCard";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  listInboundLeads,
  removeInboundLeads,
  setInboundLeadNote,
  updateInboundLeads,
} from "@/serverFunctions/inboundLeads";
import {
  INBOUND_LEAD_STATUSES,
  INBOUND_LEAD_VERDICTS,
  type InboundLeadStatus,
  type InboundLeadVerdict,
} from "@/shared/inboundLeads";
import { cn } from "cn";

const PAGE_SIZE = 50;

const queryKey = (projectId: string) => ["inbound-leads", projectId];

export function InboundLeadsView({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation("inboundLeads");
  const queryClient = useQueryClient();
  const [verdict, setVerdict] = useState<InboundLeadVerdict>("ok");
  const [status, setStatus] = useState<InboundLeadStatus | "all">("all");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: [...queryKey(projectId), verdict, status, page],
    queryFn: () =>
      listInboundLeads({
        data: {
          projectId,
          verdict,
          status: status === "all" ? undefined : status,
          page,
          pageSize: PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKey(projectId) });
  const onError = (error: unknown) =>
    toast.error(getStandardErrorMessage(error));

  const updateMutation = useMutation({
    mutationFn: (input: {
      ids: string[];
      status?: InboundLeadStatus;
      verdict?: InboundLeadVerdict;
    }) => updateInboundLeads({ data: { projectId, ...input } }),
    onSuccess: refresh,
    onError,
  });
  const noteMutation = useMutation({
    mutationFn: (input: { id: string; note: string }) =>
      setInboundLeadNote({ data: { projectId, ...input } }),
    onSuccess: async () => {
      toast.success(t("noteSaved"));
      await refresh();
    },
    onError,
  });
  const removeMutation = useMutation({
    mutationFn: (ids: string[]) =>
      removeInboundLeads({ data: { projectId, ids } }),
    onSuccess: refresh,
    onError,
  });

  const data = query.data;
  const pickVerdict = (next: InboundLeadVerdict) => {
    setVerdict(next);
    setPage(1);
  };

  return (
    <div className="overflow-auto bg-background px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title={t("title")} description={t("description")} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="flex gap-1 border-b border-border">
            {INBOUND_LEAD_VERDICTS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => pickVerdict(option)}
                className={cn(
                  "-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  verdict === option && "border-foreground text-foreground",
                )}
              >
                {t(`verdict.${option}`)}
                {data ? (
                  <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                    {data.counts[option]}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
              {status === "all" ? t("status.all") : t(`status.${status}`)}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {(["all", ...INBOUND_LEAD_STATUSES] as const).map((option) => (
                <DropdownMenuItem
                  key={option}
                  onClick={() => {
                    setStatus(option);
                    setPage(1);
                  }}
                >
                  {t(`status.${option}`)}
                  {option === status ? (
                    <Check className="ml-auto size-3.5" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {query.isError ? (
          <QueryError
            error={query.error}
            fallback={t("loadError")}
            onRetry={() => void query.refetch()}
          />
        ) : !data ? (
          <SkeletonPageContent />
        ) : data.leads.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={t(`empty.${verdict}`)}
            description={verdict === "ok" ? t("empty.hint") : undefined}
          />
        ) : (
          <ul className="space-y-3">
            {data.leads.map((lead) => (
              <InboundLeadCard
                key={lead.id}
                lead={lead}
                locale={i18n.language}
                busy={
                  updateMutation.isPending ||
                  removeMutation.isPending ||
                  noteMutation.isPending
                }
                onStatus={(next) =>
                  updateMutation.mutate({ ids: [lead.id], status: next })
                }
                onVerdict={(next) =>
                  updateMutation.mutate({ ids: [lead.id], verdict: next })
                }
                onNote={(note) => noteMutation.mutate({ id: lead.id, note })}
                onRemove={() => removeMutation.mutate([lead.id])}
              />
            ))}
          </ul>
        )}

        {data && data.total > PAGE_SIZE ? (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="tabular-nums">
              {t("range", {
                from: (page - 1) * PAGE_SIZE + 1,
                to: (page - 1) * PAGE_SIZE + data.leads.length,
                total: data.total,
              })}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                {t("previous")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page * PAGE_SIZE >= data.total}
                onClick={() => setPage(page + 1)}
              >
                {t("next")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
