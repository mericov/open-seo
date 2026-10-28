import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Spinner } from "@/client/components/Spinner";
import { Button } from "@/client/components/ui/button";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { WeeklyClicksChart } from "@/client/features/blog-tracking/WeeklyClicksChart";
import {
  AdviceBlock,
  ChecksList,
  KeywordTable,
  LinkList,
  Section,
  TodoItem,
} from "@/client/features/blog-tracking/PageInsightsParts";
import {
  pageInsightsOptions,
  pageInsightsQueryKey,
  type BlogPostRow,
  type PageInsights,
} from "@/client/features/blog-tracking/blogTrackingQueries";
import { getCurrentLanguage } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";
import { generatePageAdvice } from "@/serverFunctions/blogTracking";
import type { BlogTrackingDateRange } from "@/types/schemas/blog-tracking";

export function PageInsightsPanel({
  projectId,
  post,
  dateRange,
}: {
  projectId: string;
  post: BlogPostRow;
  dateRange: BlogTrackingDateRange;
}) {
  const { t } = useTranslation("blogTracking");
  const queryClient = useQueryClient();
  const query = useQuery(pageInsightsOptions(projectId, post.id, dateRange));
  const adviceMutation = useMutation({
    mutationFn: () =>
      generatePageAdvice({
        data: {
          projectId,
          id: post.id,
          dateRange,
          language: getCurrentLanguage() === "tr" ? "tr" : "en",
        },
      }),
    meta: { errorToast: false },
    onSuccess: (advice) => {
      queryClient.setQueryData(
        pageInsightsQueryKey(projectId, post.id, dateRange),
        (current: PageInsights | undefined) =>
          current ? { ...current, advice } : current,
      );
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  if (query.isPending)
    return <Spinner size="sm" label={t("insights.loading")} className="p-3" />;
  if (query.isError)
    return (
      <p className="p-3 text-sm text-destructive">{t("insights.failed")}</p>
    );

  const insights = query.data;
  const isBlog = post.kind === "blog";

  return (
    <div className="grid gap-3 p-3 lg:grid-cols-2">
      <div className="space-y-3">
        <Section title={t("insights.weekly")}>
          {insights.history.length > 1 ? (
            <WeeklyClicksChart weeks={insights.history} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("insights.noHistory")}
            </p>
          )}
        </Section>
        <Section title={t("queries.title")}>
          <KeywordTable keywords={insights.keywords} />
        </Section>
      </div>

      <div className="space-y-3">
        <Section title={t("insights.keywordTodo")}>
          {insights.opportunities.length === 0 &&
          post.competing.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("insights.noOpportunities")}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {insights.opportunities.map((row) => (
                <TodoItem key={row.query}>
                  {row.reason === "low_ctr"
                    ? t("opportunity.lowCtr", {
                        query: row.query,
                        position: formatNumber(row.position, {
                          maximumFractionDigits: 1,
                        }),
                      })
                    : row.placement &&
                        !row.placement.inTitle &&
                        !row.placement.inHeadings
                      ? t("opportunity.addToHeadings", {
                          query: row.query,
                          position: formatNumber(row.position, {
                            maximumFractionDigits: 1,
                          }),
                          impressions: formatNumber(row.impressions),
                        })
                      : t("opportunity.expand", {
                          query: row.query,
                          position: formatNumber(row.position, {
                            maximumFractionDigits: 1,
                          }),
                          impressions: formatNumber(row.impressions),
                        })}
                </TodoItem>
              ))}
              {post.competing.map((item) => (
                <TodoItem key={`c-${item.query}`}>
                  {t("opportunity.competing", {
                    query: item.query,
                    url: item.url,
                  })}
                </TodoItem>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t("insights.links")}>
          {insights.links.outbound.length === 0 &&
          insights.links.inbound.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("insights.noLinks")}
            </p>
          ) : (
            <div className="space-y-3">
              {insights.links.outbound.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-sm">{t("insights.linkOut")}</p>
                  <LinkList links={insights.links.outbound} />
                </div>
              ) : null}
              {insights.links.inbound.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-sm">{t("insights.linkIn")}</p>
                  <LinkList links={insights.links.inbound} />
                </div>
              ) : null}
            </div>
          )}
        </Section>

        {insights.pageReachable ? (
          <>
            <Section title={t("insights.seoChecks")}>
              <ChecksList checks={insights.checks} geo={false} />
            </Section>
            <Section title={t("insights.geoChecks")}>
              <ChecksList checks={insights.checks} geo />
              <div className="space-y-1 border-t border-border/60 pt-2 text-sm">
                <p>
                  {post.aiReferral
                    ? t("geo.aiSessions", {
                        sessions: formatNumber(post.aiReferral.sessions),
                        sources: post.aiReferral.sources
                          .map(
                            (item) =>
                              `${item.source} ${formatNumber(item.sessions)}`,
                          )
                          .join(", "),
                      })
                    : t("geo.noAiSessions")}
                </p>
                <p>
                  {post.aiCitations
                    ? t("geo.citations", {
                        count: post.aiCitations.count,
                        engines: post.aiCitations.engines
                          .map((engine) => t(`engines.${engine}`))
                          .join(", "),
                      })
                    : t("geo.noCitations")}
                </p>
              </div>
            </Section>
          </>
        ) : (
          <Section title={t("insights.seoChecks")}>
            <p className="text-sm text-muted-foreground">
              {t("insights.unreachable")}
            </p>
          </Section>
        )}

        <Section title={t("advice.title")}>
          {insights.advice ? (
            <AdviceBlock advice={insights.advice} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {isBlog ? t("advice.hintBlog") : t("advice.hintCategory")}
            </p>
          )}
          <Button
            size="sm"
            variant={insights.advice ? "outline" : "default"}
            disabled={adviceMutation.isPending}
            onClick={() => adviceMutation.mutate()}
          >
            {adviceMutation.isPending ? (
              <Spinner size="sm" />
            ) : (
              <Sparkles data-icon="inline-start" />
            )}
            {insights.advice ? t("advice.regenerate") : t("advice.generate")}
          </Button>
        </Section>
      </div>
    </div>
  );
}
