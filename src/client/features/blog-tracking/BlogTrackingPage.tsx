import { useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { FolderTree, Newspaper, Plus, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { QueryError } from "@/client/components/QueryState";
import { SkeletonPage } from "@/client/components/SkeletonPresets";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { BlogPostTableRow } from "@/client/features/blog-tracking/BlogPostTableRow";
import { AddBlogPostsDialog } from "@/client/features/blog-tracking/AddBlogPostsDialog";
import { EditBlogPostDialog } from "@/client/features/blog-tracking/EditBlogPostDialog";
import { PageAlertsView } from "@/client/features/blog-tracking/PageAlertsView";
import { formatWeek } from "@/client/features/blog-tracking/WeeklyClicksChart";
import { PageSummary } from "@/client/features/blog-tracking/PageSummary";
import {
  blogTrackingQueryKey,
  blogTrackingReportOptions,
  type BlogPostRow,
} from "@/client/features/blog-tracking/blogTrackingQueries";
import { removeBlogPosts, runPageCheck } from "@/serverFunctions/blogTracking";
import {
  BLOG_TRACKING_RANGES,
  BLOG_TRACKING_VIEWS,
  type BlogTrackingDateRange,
  type BlogTrackingView,
} from "@/types/schemas/blog-tracking";

function isView(value: unknown): value is BlogTrackingView {
  return (BLOG_TRACKING_VIEWS as readonly unknown[]).includes(value);
}

function isRange(value: string): value is BlogTrackingDateRange {
  return (BLOG_TRACKING_RANGES as readonly string[]).includes(value);
}

export function BlogTrackingPage({
  projectId,
  dateRange,
  view,
  onDateRangeChange,
  onViewChange,
}: {
  projectId: string;
  dateRange: BlogTrackingDateRange;
  view: BlogTrackingView;
  onDateRangeChange: (range: BlogTrackingDateRange) => void;
  onViewChange: (view: BlogTrackingView) => void;
}) {
  const { t } = useTranslation("blogTracking");
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<BlogPostRow | null>(null);
  const [removing, setRemoving] = useState<BlogPostRow | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const reportQuery = useQuery({
    ...blogTrackingReportOptions(projectId, dateRange),
    placeholderData: keepPreviousData,
  });
  const report = reportQuery.data;

  const removal = useMutation({
    mutationFn: (post: BlogPostRow) =>
      removeBlogPosts({ data: { projectId, ids: [post.id] } }),
    meta: { errorToast: false },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: blogTrackingQueryKey(projectId),
      });
      toast.success(t("row.removed"));
      setRemoving(null);
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const check = useMutation({
    mutationFn: () => runPageCheck({ data: { projectId } }),
    meta: { errorToast: false },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: blogTrackingQueryKey(projectId),
      });
      if (!result.connected) toast.error(t("connectHint"));
      else if (!result.caughtUp) toast.success(t("check.partial"));
      else toast.success(t("check.done"));
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const rangeItems = BLOG_TRACKING_RANGES.map((range) => ({
    value: range,
    label: t(`ranges.${range}`),
  }));

  const allPosts = report?.posts ?? [];
  const kind = view === "category" ? "category" : "blog";
  const posts = allPosts.filter((post) => post.kind === kind);
  const trend = (report?.trend ?? []).filter((week) => week.kind === kind);
  const alerts = report?.alerts ?? [];
  const blogCount = allPosts.filter((post) => post.kind === "blog").length;
  const categoryCount = allPosts.length - blogCount;
  const EmptyIcon = kind === "blog" ? Newspaper : FolderTree;

  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            <>
              <Select
                items={rangeItems}
                value={dateRange}
                onValueChange={(value) => {
                  if (value && isRange(value)) onDateRangeChange(value);
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="w-36"
                  aria-label={t("rangeLabel")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rangeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={check.isPending}
                onClick={() => check.mutate()}
              >
                <RefreshCw data-icon="inline-start" />
                {t("check.run")}
              </Button>
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus data-icon="inline-start" />
                {kind === "blog" ? t("addPosts") : t("addCategories")}
              </Button>
            </>
          }
        />

        <Tabs
          value={view}
          onValueChange={(value) => {
            if (isView(value)) onViewChange(value);
          }}
        >
          <TabsList variant="line">
            <TabsTrigger value="blog">
              {t("views.blog")}
              <span className="text-xs text-muted-foreground">{blogCount}</span>
            </TabsTrigger>
            <TabsTrigger value="category">
              {t("views.category")}
              <span className="text-xs text-muted-foreground">
                {categoryCount}
              </span>
            </TabsTrigger>
            <TabsTrigger value="alerts">
              {t("views.alerts")}
              {alerts.length > 0 ? (
                <Badge variant="destructive" size="sm" className="ml-1.5">
                  {alerts.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {reportQuery.isPending ? (
          <SkeletonPage />
        ) : !report ? (
          <QueryError
            error={reportQuery.error}
            fallback={t("loadFailed")}
            onRetry={() => void reportQuery.refetch()}
            isRetrying={reportQuery.isFetching}
          />
        ) : (
          <>
            {!report.connected ? (
              <Alert variant="info">
                <AlertDescription>{t("connectHint")}</AlertDescription>
              </Alert>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {report.latestWeek
                ? t("check.lastWeek", { week: formatWeek(report.latestWeek) })
                : t("check.never")}
            </p>

            {view === "alerts" ? (
              <PageAlertsView
                projectId={projectId}
                alerts={alerts}
                posts={allPosts}
              />
            ) : (
              <>
                <PageSummary
                  kind={kind}
                  posts={posts}
                  trend={trend}
                  onOpen={setExpanded}
                />

                {posts.length === 0 ? (
                  <EmptyState
                    icon={EmptyIcon}
                    title={
                      kind === "blog"
                        ? t("empty.title")
                        : t("empty.categoryTitle")
                    }
                    description={
                      kind === "blog"
                        ? t("empty.description")
                        : t("empty.categoryDescription")
                    }
                    action={
                      <Button size="sm" onClick={() => setAdding(true)}>
                        <Plus data-icon="inline-start" />
                        {kind === "blog" ? t("addPosts") : t("addCategories")}
                      </Button>
                    }
                  />
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8" />
                          <TableHead>
                            {kind === "blog"
                              ? t("columns.post")
                              : t("columns.category")}
                          </TableHead>
                          <TableHead>{t("columns.status")}</TableHead>
                          <TableHead className="text-right">
                            {t("columns.clicks")}
                          </TableHead>
                          <TableHead className="text-right">
                            {t("columns.change")}
                          </TableHead>
                          <TableHead className="text-right">
                            {t("columns.impressions")}
                          </TableHead>
                          <TableHead className="text-right">
                            {t("columns.ctr")}
                          </TableHead>
                          <TableHead className="text-right">
                            {t("columns.position")}
                          </TableHead>
                          <TableHead className="text-right">
                            {t("columns.ai")}
                          </TableHead>
                          <TableHead>{t("columns.targetKeyword")}</TableHead>
                          <TableHead className="w-10">
                            <span className="sr-only">
                              {t("columns.actions")}
                            </span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {posts.map((post) => {
                          const isOpen = expanded === post.id;
                          return (
                            <BlogPostTableRow
                              key={post.id}
                              post={post}
                              isOpen={isOpen}
                              connected={report.connected}
                              projectId={projectId}
                              dateRange={dateRange}
                              onToggle={() =>
                                setExpanded(isOpen ? null : post.id)
                              }
                              onEdit={() => setEditing(post)}
                              onRemove={() => setRemoving(post)}
                            />
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {adding ? (
        <AddBlogPostsDialog
          projectId={projectId}
          kind={kind}
          suggestions={kind === "blog" ? (report?.suggestions ?? []) : []}
          onClose={() => setAdding(false)}
        />
      ) : null}
      {editing ? (
        <EditBlogPostDialog
          projectId={projectId}
          post={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog
          title={t("row.removeConfirm")}
          confirmLabel={t("row.remove")}
          destructive
          pending={removal.isPending}
          onConfirm={() => removal.mutate(removing)}
          onClose={() => setRemoving(null)}
        >
          <p className="break-all text-sm text-muted-foreground">
            {removing.url}
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
