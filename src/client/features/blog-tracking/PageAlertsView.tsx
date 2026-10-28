import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { EmptyState } from "@/client/components/EmptyState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  blogTrackingQueryKey,
  type BlogPostRow,
  type PageAlert,
} from "@/client/features/blog-tracking/blogTrackingQueries";
import { postLabel } from "@/client/features/blog-tracking/BlogPostTableRow";
import { formatWeek } from "@/client/features/blog-tracking/WeeklyClicksChart";
import { formatNumber } from "@/i18n/format";
import { markPageAlertsSeen } from "@/serverFunctions/blogTracking";
import type { PageAlertKind } from "@/shared/pageTracking";

const KIND_VARIANTS: Record<
  PageAlertKind,
  "destructive" | "warning" | "success"
> = {
  clicks_drop: "destructive",
  position_drop: "warning",
  keyword_lost: "warning",
  no_impressions: "destructive",
  rising: "success",
};

export function PageAlertsView({
  projectId,
  alerts,
  posts,
}: {
  projectId: string;
  alerts: PageAlert[];
  posts: BlogPostRow[];
}) {
  const { t } = useTranslation("blogTracking");
  const queryClient = useQueryClient();
  const postsById = new Map(posts.map((post) => [post.id, post]));
  const seen = useMutation({
    mutationFn: (ids: string[]) =>
      markPageAlertsSeen({ data: { projectId, ids } }),
    meta: { errorToast: false },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: blogTrackingQueryKey(projectId),
      }),
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  if (alerts.length === 0)
    return (
      <EmptyState
        icon={BellOff}
        title={t("alerts.emptyTitle")}
        description={t("alerts.emptyDescription")}
      />
    );

  const message = (alert: PageAlert) => {
    const values = {
      previous: formatNumber(alert.previousValue, { maximumFractionDigits: 1 }),
      current: formatNumber(alert.currentValue, { maximumFractionDigits: 1 }),
      query: alert.query,
    };
    if (alert.kind === "keyword_lost" && alert.currentValue === 0)
      return t("alerts.messages.keyword_gone", values);
    return t(`alerts.messages.${alert.kind}`, values);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t("alerts.hint")}</p>
        <Button
          size="sm"
          variant="outline"
          disabled={seen.isPending}
          onClick={() => seen.mutate(alerts.map((alert) => alert.id))}
        >
          {t("alerts.markAll")}
        </Button>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {alerts.map((alert) => {
          const post = postsById.get(alert.postId);
          return (
            <li key={alert.id} className="flex items-start gap-3 p-3">
              <Badge variant={KIND_VARIANTS[alert.kind]} className="mt-0.5">
                {t(`alerts.kinds.${alert.kind}`)}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {post ? postLabel(post) : alert.postId}
                </p>
                <p className="text-sm text-muted-foreground">
                  {message(alert)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("alerts.week", { week: formatWeek(alert.weekStart) })}
                </p>
              </div>
              <Button
                size="xs"
                variant="ghost"
                disabled={seen.isPending}
                onClick={() => seen.mutate([alert.id])}
              >
                {t("alerts.markSeen")}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
