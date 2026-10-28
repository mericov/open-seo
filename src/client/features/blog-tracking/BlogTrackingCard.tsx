import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Newspaper } from "lucide-react";
import { sort } from "remeda";
import { useTranslation } from "react-i18next";
import { CardShell } from "@/client/components/CardShell";
import { QueryError } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import { Skeleton } from "@/client/components/ui/skeleton";
import { moreDetailsClass } from "@/client/features/dashboard/cardParts";
import { postLabel } from "@/client/features/blog-tracking/BlogPostTableRow";
import {
  blogTrackingReportOptions,
  type BlogPostRow,
} from "@/client/features/blog-tracking/blogTrackingQueries";
import { formatNumber } from "@/i18n/format";
import type { TrackedPageKind } from "@/shared/pageTracking";

const PRIORITY_LIMIT = 6;

function KindSummary({
  projectId,
  kind,
  posts,
  alertCount,
}: {
  projectId: string;
  kind: TrackedPageKind;
  posts: BlogPostRow[];
  alertCount: number;
}) {
  const { t } = useTranslation("blogTracking");
  const clicks = posts.reduce(
    (sum, post) => sum + (post.current?.clicks ?? 0),
    0,
  );
  const previous = posts.reduce(
    (sum, post) => sum + (post.previous?.clicks ?? 0),
    0,
  );
  const change = previous > 0 ? (clicks - previous) / previous : null;
  const aiSessions = posts.reduce(
    (sum, post) => sum + (post.aiReferral?.sessions ?? 0),
    0,
  );
  return (
    <Link
      to="/p/$projectId/blog-tracking"
      params={{ projectId }}
      search={{ view: kind }}
      className="rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
    >
      <p className="text-xs font-medium text-muted-foreground">
        {t(`views.${kind}`)} · {formatNumber(posts.length)}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {formatNumber(clicks)}
        {change !== null ? (
          <span
            className={`ml-2 text-sm font-medium ${change >= 0 ? "text-success" : "text-destructive"}`}
          >
            {formatNumber(change, {
              style: "percent",
              maximumFractionDigits: 0,
              signDisplay: "exceptZero",
            })}
          </span>
        ) : null}
      </p>
      <p className="text-xs text-muted-foreground">{t("card.clicks28")}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {alertCount > 0 ? (
          <Badge variant="destructive" size="sm">
            {t("card.alerts", { count: alertCount })}
          </Badge>
        ) : null}
        {aiSessions > 0 ? (
          <Badge variant="info" size="sm">
            {t("card.aiSessions", { count: aiSessions })}
          </Badge>
        ) : null}
      </div>
    </Link>
  );
}

export function PriorityReason({ post }: { post: BlogPostRow }) {
  const { t } = useTranslation("blogTracking");
  const lost = (post.previous?.clicks ?? 0) - (post.current?.clicks ?? 0);
  return (
    <span className="shrink-0 text-xs text-muted-foreground">
      {lost > 0
        ? t("priority.lost", { clicks: formatNumber(lost) })
        : t("priority.close", {
            position: formatNumber(post.current?.position ?? 0, {
              maximumFractionDigits: 1,
            }),
          })}
    </span>
  );
}

export function BlogTrackingCard({ projectId }: { projectId: string }) {
  const { t } = useTranslation("blogTracking");
  const query = useQuery(blogTrackingReportOptions(projectId, "last_28_days"));
  const report = query.data;
  const posts = report?.posts ?? [];
  const kindById = new Map(posts.map((post) => [post.id, post.kind]));
  const alertCount = (kind: TrackedPageKind) =>
    (report?.alerts ?? []).filter(
      (alert) => kindById.get(alert.postId) === kind,
    ).length;
  const priority = sort(
    posts.filter((post) => post.updatePriority >= 1),
    (a, b) => b.updatePriority - a.updatePriority,
  ).slice(0, PRIORITY_LIMIT);

  return (
    <CardShell
      title={t("card.title")}
      icon={<Newspaper className="size-4" />}
      action={
        <Link
          to="/p/$projectId/blog-tracking"
          params={{ projectId }}
          className={moreDetailsClass}
        >
          {t("card.viewAll")}
        </Link>
      }
    >
      {query.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !report ? (
        <QueryError
          error={query.error}
          fallback={t("loadFailed")}
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      ) : posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {report.connected ? t("card.empty") : t("connectHint")}
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(["blog", "category"] as const).map((kind) => (
              <KindSummary
                key={kind}
                projectId={projectId}
                kind={kind}
                posts={posts.filter((post) => post.kind === kind)}
                alertCount={alertCount(kind)}
              />
            ))}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("priority.title")}
            </p>
            {priority.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("card.noPriority")}
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {priority.map((post) => (
                  <li key={post.id} className="flex items-center gap-2">
                    <Badge variant="outline" size="sm">
                      {t(`linkKinds.${post.kind}`)}
                    </Badge>
                    <Link
                      to="/p/$projectId/blog-tracking"
                      params={{ projectId }}
                      search={{ view: post.kind, open: post.id }}
                      className="min-w-0 flex-1 truncate text-sm hover:underline"
                    >
                      {postLabel(post)}
                    </Link>
                    <PriorityReason post={post} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </CardShell>
  );
}
