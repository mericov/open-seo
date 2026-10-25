import { useQuery } from "@tanstack/react-query";
import { Check, MailCheck, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/client/components/EmptyState";
import { QueryError } from "@/client/components/QueryState";
import { SafeExternalLink } from "@/client/components/SafeExternalLink";
import { SkeletonPage } from "@/client/components/SkeletonPresets";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { localToday } from "@/client/features/leads/LeadNote";
import { MailButton } from "@/client/features/leads/MailButton";
import {
  leadFollowUpsOptions,
  leadTemplatesOptions,
  type LeadFollowUp,
} from "@/client/features/leads/leadQueries";
import { useLeadActions } from "@/client/features/leads/useLeadActions";
import { useMailClient } from "@/client/features/leads/useMailClient";
import { formatRelativeTime } from "@/client/lib/relative-time";

function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

export function FollowUpsView({ projectId }: { projectId: string }) {
  const { t } = useTranslation("leads");
  const today = localToday();
  const followUpsQuery = useQuery(leadFollowUpsOptions(projectId, today));
  const templatesQuery = useQuery(leadTemplatesOptions(projectId));
  const [mailClient] = useMailClient();
  const actions = useLeadActions(projectId, () => {});

  if (followUpsQuery.isPending) return <SkeletonPage />;
  if (followUpsQuery.isError && !followUpsQuery.data) {
    return (
      <QueryError
        error={followUpsQuery.error}
        fallback={t("detail.loadFailed")}
        onRetry={() => void followUpsQuery.refetch()}
        isRetrying={followUpsQuery.isFetching}
      />
    );
  }
  const items = followUpsQuery.data;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("followUps.description")}
      </p>
      {items.length === 0 ? (
        <EmptyState
          icon={MailCheck}
          title={t("followUps.empty")}
          description={t("followUps.emptyDescription")}
        />
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-background">
          {items.map((item) => (
            <FollowUpRow
              key={item.lead.id}
              item={item}
              today={today}
              templates={templatesQuery.data ?? []}
              mailClient={mailClient}
              onSent={() =>
                actions.recordMail.mutate(
                  { leadId: item.lead.id, step: item.step },
                  { onSuccess: () => toast.success(t("followUps.sent")) },
                )
              }
              onReplied={() =>
                actions.status.mutate({
                  leadIds: [item.lead.id],
                  status: "replied",
                })
              }
              onSkip={() => actions.stopFollowUp.mutate(item.lead.id)}
              busy={actions.status.isPending || actions.stopFollowUp.isPending}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FollowUpRow({
  item,
  today,
  templates,
  mailClient,
  onSent,
  onReplied,
  onSkip,
  busy,
}: {
  item: LeadFollowUp;
  today: string;
  templates: Parameters<typeof MailButton>[0]["templates"];
  mailClient: Parameters<typeof MailButton>[0]["mailClient"];
  onSent: () => void;
  onReplied: () => void;
  onSkip: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation("leads");
  const { lead, step, dueOn } = item;
  const overdue = daysBetween(dueOn, today);

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{lead.name}</p>
          <Badge variant="outline" size="sm">
            {t("followUps.step", { step })}
          </Badge>
          {overdue > 0 ? (
            <Badge variant="destructive" size="sm">
              {t("followUps.overdue", { count: overdue })}
            </Badge>
          ) : (
            <Badge variant="warning" size="sm">
              {t("followUps.dueToday")}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {lead.website ? (
            <SafeExternalLink
              url={lead.website}
              label={lead.domain ?? lead.website}
              className="hover:text-foreground hover:underline"
            />
          ) : null}
          {lead.followUpSentAt ? (
            <>
              <span className="mx-1.5 opacity-40">·</span>
              {t("followUps.lastSent", {
                when: formatRelativeTime(lead.followUpSentAt),
              })}
            </>
          ) : null}
          {lead.reportViews > 0 ? (
            <>
              <span className="mx-1.5 opacity-40">·</span>
              <span className="font-medium text-success">
                {t("report.viewsShort", { count: lead.reportViews })}
              </span>
            </>
          ) : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <MailButton
          lead={lead}
          step={step}
          label={t("followUps.send")}
          templates={templates}
          mailClient={mailClient}
          onOpened={onSent}
        />
        <Button size="sm" variant="ghost" disabled={busy} onClick={onReplied}>
          <Check data-icon="inline-start" />
          {t("followUps.replied")}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onSkip}>
          <SkipForward data-icon="inline-start" />
          {t("followUps.skip")}
        </Button>
      </div>
    </li>
  );
}
