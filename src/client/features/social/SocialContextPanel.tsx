import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/client/components/Markdown";
import { Button } from "@/client/components/ui/button";
import { Skeleton } from "@/client/components/ui/skeleton";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  formatSocialDate,
  socialContextOptions,
} from "@/client/features/social/socialQueries";
import { getSocialContext } from "@/serverFunctions/social";

export function SocialContextPanel({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation("social");
  const queryClient = useQueryClient();
  const query = useQuery(socialContextOptions(projectId));
  const refresh = useMutation({
    mutationFn: () => getSocialContext({ data: { projectId, refresh: true } }),
    onSuccess: (data) => {
      queryClient.setQueryData(socialContextOptions(projectId).queryKey, data);
      toast.success(t("context.refreshed"));
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError)
    return (
      <p className="text-sm text-destructive">
        {getStandardErrorMessage(query.error)}
      </p>
    );
  const { context, markdown } = query.data;
  const stats = [
    {
      label: t("context.stats.keywords"),
      value: context.keywords.saved.length + context.keywords.tracked.length,
    },
    {
      label: t("context.stats.queries"),
      value: context.search.searchConsole?.topQueriesByImpressions.length ?? 0,
    },
    { label: t("context.stats.products"), value: context.site.products.length },
    {
      label: t("context.stats.collections"),
      value: context.site.collections.length,
    },
    {
      label: t("context.stats.articles"),
      value: context.site.articles.length + context.content.blogDrafts.length,
    },
    {
      label: t("context.stats.posts"),
      value: context.content.socialPosts.length,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("context.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("context.description")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("context.builtAt", {
              date: formatSocialDate(context.builtAt, i18n.language),
            })}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          pending={refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          <RefreshCw className="size-4" />
          {t("context.refresh")}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border p-3">
            <p className="text-2xl font-semibold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
      {context.missing.length > 0 ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium">{t("context.missing")}</p>
          <p className="mb-2 text-muted-foreground">
            {t("context.missingHint")}
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {context.missing.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="max-h-[70vh] overflow-auto rounded-lg border p-4 text-sm">
        <Markdown>{markdown}</Markdown>
      </div>
    </div>
  );
}
