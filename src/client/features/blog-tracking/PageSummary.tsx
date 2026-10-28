import { sort } from "remeda";
import { useTranslation } from "react-i18next";
import { postLabel } from "@/client/features/blog-tracking/BlogPostTableRow";
import { PriorityReason } from "@/client/features/blog-tracking/BlogTrackingCard";
import { WeeklyClicksChart } from "@/client/features/blog-tracking/WeeklyClicksChart";
import type {
  BlogPostRow,
  BlogTrackingReport,
} from "@/client/features/blog-tracking/blogTrackingQueries";
import { formatNumber } from "@/i18n/format";
import type { TrackedPageKind } from "@/shared/pageTracking";

const PRIORITY_LIMIT = 5;

export function PageSummary({
  kind,
  posts,
  trend,
  onOpen,
}: {
  kind: TrackedPageKind;
  posts: BlogPostRow[];
  trend: BlogTrackingReport["trend"];
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation("blogTracking");
  const totalClicks = posts.reduce(
    (sum, post) => sum + (post.current?.clicks ?? 0),
    0,
  );
  const aiSessions = posts.reduce(
    (sum, post) => sum + (post.aiReferral?.sessions ?? 0),
    0,
  );
  const rising = posts.filter((post) => post.status === "rising").length;
  const declining = posts.filter((post) => post.status === "declining").length;
  const priority = sort(
    posts.filter((post) => post.updatePriority >= 1),
    (a, b) => b.updatePriority - a.updatePriority,
  ).slice(0, PRIORITY_LIMIT);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          {
            label:
              kind === "blog"
                ? t("summary.total")
                : t("summary.totalCategories"),
            value: posts.length,
          },
          { label: t("summary.clicks"), value: totalClicks },
          { label: t("summary.aiSessions"), value: aiSessions },
          { label: t("summary.rising"), value: rising },
          { label: t("summary.declining"), value: declining },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatNumber(item.value)}
            </p>
          </div>
        ))}
      </div>

      {trend.length > 1 || priority.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {trend.length > 1 ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">
                {t("trend.title")}
              </p>
              <WeeklyClicksChart weeks={trend} className="mt-2 h-32" />
            </div>
          ) : null}
          {priority.length > 0 ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">
                {t("priority.title")}
              </p>
              <ol className="mt-2 space-y-1.5">
                {priority.map((post) => (
                  <li key={post.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
                      onClick={() => onOpen(post.id)}
                    >
                      {postLabel(post)}
                    </button>
                    <PriorityReason post={post} />
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
