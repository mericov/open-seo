import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ExternalLink, Send, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { CopyButton } from "@/client/components/CopyButton";
import { BackLink, PageHeader } from "@/client/components/PageHeader";
import { QueryError } from "@/client/components/QueryState";
import { SkeletonPage } from "@/client/components/SkeletonPresets";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/client/components/ui/tabs";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { projectsQueryOptions } from "@/client/features/projects/projectQueries";
import { BlogDraftImages } from "@/client/features/blog-writer/BlogDraftImages";
import { BlogDraftPublishDialog } from "@/client/features/blog-writer/BlogDraftPublishDialog";
import { BlogDraftSections } from "@/client/features/blog-writer/BlogDraftSections";
import { BlogDraftSeoForm } from "@/client/features/blog-writer/BlogDraftSeoForm";
import {
  blogDraftOptions,
  blogWriterQueryKey,
  type BlogDraft,
} from "@/client/features/blog-writer/blogWriterQueries";
import { deleteBlogDraft } from "@/serverFunctions/blogDrafts";
import { blogTrackingQueryKey } from "@/client/features/blog-tracking/blogTrackingQueries";
import { ShopifyPublishButton } from "@/client/features/shopify/ShopifyPublishSection";

const PREVIEW_STYLES = `
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2328; line-height: 1.7; max-width: 720px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 2rem; line-height: 1.25; margin: 0 0 1rem; }
  h2 { font-size: 1.45rem; margin: 2rem 0 .75rem; }
  h3 { font-size: 1.15rem; margin: 1.5rem 0 .5rem; }
  a { color: #2457c5; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #d0d7de; padding: 6px 10px; text-align: left; }
  blockquote { border-left: 3px solid #d0d7de; margin: 1rem 0; padding-left: 1rem; color: #57606a; }
  img { max-width: 100%; }
`;

function previewDocument(draft: BlogDraft) {
  const title = draft.title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${PREVIEW_STYLES}</style></head><body><h1>${title}</h1>${draft.publishHtml}</body></html>`;
}

function DraftFacts({ draft }: { draft: BlogDraft }) {
  const { t } = useTranslation("blogWriter");
  const facts = [
    { label: t("detail.targetKeyword"), value: draft.targetKeyword },
    {
      label: t("detail.secondaryKeywords"),
      value: draft.secondaryKeywords.join(", ") || "–",
    },
    { label: t("detail.words"), value: String(draft.wordCount) },
    { label: t("detail.language"), value: draft.languageCode ?? "–" },
  ];
  return (
    <dl className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-4">
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{fact.label}</dt>
          <dd className="truncate text-sm font-medium" title={fact.value}>
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DraftBody({
  projectId,
  draft,
  siteDomain,
}: {
  projectId: string;
  draft: BlogDraft;
  siteDomain: string | null;
}) {
  const { t } = useTranslation("blogWriter");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const removal = useMutation({
    mutationFn: () => deleteBlogDraft({ data: { projectId, id: draft.id } }),
    meta: { errorToast: false },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: blogWriterQueryKey(projectId),
      });
      toast.success(t("detail.deleted"));
      void navigate({
        to: "/p/$projectId/blog-writer",
        params: { projectId },
        search: {},
      });
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const revisePrompt = t("detail.revisePrompt", {
    title: draft.title,
    projectId,
    draftId: draft.id,
  });

  return (
    <>
      <PageHeader
        backLink={
          <BackLink
            to="/p/$projectId/blog-writer"
            params={{ projectId }}
            search={{}}
          >
            {t("detail.back")}
          </BackLink>
        }
        title={draft.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge
              variant={draft.status === "published" ? "success" : "secondary"}
            >
              {t(`status.${draft.status}`)}
            </Badge>
            {draft.publishedUrl ? (
              <a
                href={draft.publishedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-4"
              >
                {draft.publishedUrl}
                <ExternalLink className="size-3" />
              </a>
            ) : null}
            {draft.status === "published" ? (
              <Link
                to="/p/$projectId/blog-tracking"
                params={{ projectId }}
                className="underline underline-offset-4"
              >
                {t("detail.viewTracking")}
              </Link>
            ) : null}
          </span>
        }
        actions={
          <>
            <ShopifyPublishButton
              projectId={projectId}
              draftId={draft.id}
              onPublished={() =>
                Promise.all([
                  queryClient.invalidateQueries({
                    queryKey: blogWriterQueryKey(projectId),
                  }),
                  queryClient.invalidateQueries({
                    queryKey: blogTrackingQueryKey(projectId),
                  }),
                ])
              }
            />
            <CopyButton
              variant="outline"
              size="sm"
              value={draft.publishHtml}
              label={t("detail.copyHtml")}
              successMessage={t("detail.htmlCopied")}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPublishing(true)}
            >
              <Send data-icon="inline-start" />
              {t("detail.publish")}
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t("detail.delete")}
              onClick={() => setDeleting(true)}
            >
              <Trash2 />
            </Button>
          </>
        }
      />

      <DraftFacts draft={draft} />

      <Tabs defaultValue="preview">
        <TabsList variant="line">
          <TabsTrigger value="preview">{t("detail.preview")}</TabsTrigger>
          <TabsTrigger value="html">{t("detail.html")}</TabsTrigger>
          <TabsTrigger value="seo">{t("detail.seo")}</TabsTrigger>
          <TabsTrigger value="images">
            {t("detail.images")} ({draft.imageSuggestions.length})
          </TabsTrigger>
          <TabsTrigger value="details">
            {t("detail.faq")} · {t("detail.links")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="preview" className="pt-4">
          <iframe
            title={t("detail.previewTitle")}
            sandbox=""
            srcDoc={previewDocument(draft)}
            className="h-[70vh] w-full rounded-xl border border-border bg-white"
          />
        </TabsContent>
        <TabsContent value="html" className="space-y-3 pt-4">
          <p className="text-sm text-muted-foreground">
            {t("detail.htmlHint")}
          </p>
          <div className="flex flex-wrap gap-2">
            <CopyButton
              size="sm"
              variant="default"
              value={draft.publishHtml}
              label={t("detail.copyHtml")}
              successMessage={t("detail.htmlCopied")}
            />
            <CopyButton
              size="sm"
              value={draft.contentHtml}
              label={t("detail.copyBodyOnly")}
              successMessage={t("detail.htmlCopied")}
            />
            {draft.faqSchema ? (
              <CopyButton
                size="sm"
                value={`<script type="application/ld+json">\n${draft.faqSchema}\n</script>`}
                label={t("detail.copyFaqSchema")}
                successMessage={t("detail.schemaCopied")}
              />
            ) : null}
          </div>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-muted/40 p-4 font-mono text-xs">
            {draft.publishHtml}
          </pre>
        </TabsContent>
        <TabsContent value="seo" className="max-w-2xl pt-4">
          <BlogDraftSeoForm
            key={draft.updatedAt}
            projectId={projectId}
            draft={draft}
          />
        </TabsContent>
        <TabsContent value="images" className="pt-4">
          <BlogDraftImages projectId={projectId} draft={draft} />
        </TabsContent>
        <TabsContent value="details" className="max-w-3xl pt-4">
          <BlogDraftSections draft={draft} />
        </TabsContent>
      </Tabs>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">{t("detail.reviseTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{revisePrompt}…</p>
        <CopyButton
          className="mt-3"
          size="sm"
          value={revisePrompt}
          label={t("detail.copyRevise")}
          successMessage={t("detail.copied")}
        />
      </div>

      {publishing ? (
        <BlogDraftPublishDialog
          projectId={projectId}
          draft={draft}
          siteDomain={siteDomain}
          onClose={() => setPublishing(false)}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={t("detail.deleteConfirm")}
          confirmLabel={t("detail.delete")}
          destructive
          pending={removal.isPending}
          onConfirm={() => removal.mutate()}
          onClose={() => setDeleting(false)}
        >
          <p className="text-sm text-muted-foreground">
            {t("detail.deleteDescription")}
          </p>
        </ConfirmDialog>
      ) : null}
    </>
  );
}

export function BlogDraftDetail({
  projectId,
  draftId,
}: {
  projectId: string;
  draftId: string;
}) {
  const { t } = useTranslation("blogWriter");
  const draftQuery = useQuery(blogDraftOptions(projectId, draftId));
  const projectsQuery = useQuery(projectsQueryOptions());
  const siteDomain =
    projectsQuery.data?.find((project) => project.id === projectId)?.domain ??
    null;

  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-5xl space-y-5">
        {draftQuery.isPending ? (
          <SkeletonPage />
        ) : draftQuery.isError ? (
          <QueryError
            error={draftQuery.error}
            fallback={t("detail.loadFailed")}
            onRetry={() => void draftQuery.refetch()}
            isRetrying={draftQuery.isFetching}
          />
        ) : (
          <DraftBody
            projectId={projectId}
            draft={draftQuery.data}
            siteDomain={siteDomain}
          />
        )}
      </div>
    </div>
  );
}
