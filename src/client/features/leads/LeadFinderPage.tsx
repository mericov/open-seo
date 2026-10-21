import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { QueryError } from "@/client/components/QueryState";
import { SkeletonPage } from "@/client/components/SkeletonPresets";
import { Badge } from "@/client/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { leadSearchesOptions } from "@/client/features/leads/leadQueries";
import { formatRelativeTime } from "@/client/lib/relative-time";
import { AllLeadsView } from "@/client/features/leads/AllLeadsView";
import { LocalSearchForm } from "@/client/features/leads/LocalSearchForm";
import { StoreSearchForm } from "@/client/features/leads/StoreSearchForm";
import { cn } from "cn";

export function LeadFinderPage({
  projectId,
  view,
}: {
  projectId: string;
  view: "searches" | "all";
}) {
  const { t } = useTranslation("leads");
  const navigate = useNavigate();

  return (
    <div className="overflow-auto bg-background px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div
        className={cn(
          "mx-auto space-y-6",
          view === "all" ? "max-w-6xl" : "max-w-5xl",
        )}
      >
        <PageHeader title={t("title")} description={t("description")} />
        <Tabs
          value={view}
          onValueChange={(value) =>
            void navigate({
              to: "/p/$projectId/leads",
              params: { projectId },
              search: value === "all" ? { view: "all" } : {},
            })
          }
        >
          <TabsList variant="line">
            <TabsTrigger value="searches">{t("views.searches")}</TabsTrigger>
            <TabsTrigger value="all">{t("views.all")}</TabsTrigger>
          </TabsList>
        </Tabs>
        {view === "all" ? (
          <AllLeadsView projectId={projectId} />
        ) : (
          <SearchesView projectId={projectId} />
        )}
      </div>
    </div>
  );
}

function SearchesView({ projectId }: { projectId: string }) {
  const { t } = useTranslation("leads");
  const searchesQuery = useQuery(leadSearchesOptions(projectId));
  const [source, setSource] = useState<"local" | "shopify">("local");

  return (
    <>
      <div className="space-y-3">
        <Tabs
          value={source}
          onValueChange={(value) => setSource(value as "local" | "shopify")}
        >
          <TabsList>
            <TabsTrigger value="local">{t("sources.local")}</TabsTrigger>
            <TabsTrigger value="shopify">{t("sources.shopify")}</TabsTrigger>
          </TabsList>
        </Tabs>
        {source === "local" ? (
          <LocalSearchForm projectId={projectId} />
        ) : (
          <StoreSearchForm projectId={projectId} />
        )}
      </div>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {t("list.title")}
        </h2>
        {searchesQuery.isPending ? (
          <SkeletonPage />
        ) : searchesQuery.isError ? (
          <QueryError
            error={searchesQuery.error}
            fallback={t("detail.loadFailed")}
            onRetry={() => void searchesQuery.refetch()}
            isRetrying={searchesQuery.isFetching}
          />
        ) : searchesQuery.data.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("list.empty")}
            description={t("list.emptyDescription")}
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {searchesQuery.data.map((search) => (
              <li key={search.id}>
                <Link
                  to="/p/$projectId/leads"
                  params={{ projectId }}
                  search={{ search: search.id }}
                  className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{search.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t("list.summary", {
                        total: search.total,
                        ready: search.ready,
                      })}{" "}
                      · {formatRelativeTime(search.updatedAt)}
                    </p>
                  </div>
                  {search.pending > 0 ? (
                    <Badge
                      variant="warning"
                      className="self-start sm:self-center"
                    >
                      {t("list.pending", { count: search.pending })}
                    </Badge>
                  ) : (
                    <Badge
                      variant="success"
                      className="self-start sm:self-center"
                    >
                      {t("list.ready", { count: search.ready })}
                    </Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
