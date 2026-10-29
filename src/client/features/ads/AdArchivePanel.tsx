import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/client/components/Markdown";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Skeleton } from "@/client/components/ui/skeleton";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  addAdPages,
  deleteCompetitorAd,
  getAdReport,
  listAdPages,
  listCompetitorAds,
  removeAdPage,
} from "@/serverFunctions/ads";

export const adsQueryKey = (projectId: string) => ["ads", projectId];

function AdPages({ projectId }: { projectId: string }) {
  const { t } = useTranslation("ads");
  const queryClient = useQueryClient();
  const pages = useQuery({
    queryKey: [...adsQueryKey(projectId), "pages"],
    queryFn: () => listAdPages({ data: { projectId } }),
  });
  const [pageId, setPageId] = useState("");
  const [pageName, setPageName] = useState("");
  const [kind, setKind] = useState<"competitor" | "similar">("competitor");
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: adsQueryKey(projectId) });
  const add = useMutation({
    mutationFn: () =>
      addAdPages({ data: { projectId, pages: [{ pageId, pageName, kind }] } }),
    onSuccess: async () => {
      setPageId("");
      setPageName("");
      await refresh();
      toast.success(t("pages.added"));
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      removeAdPage({ data: { projectId, pageId: id } }),
    onSuccess: refresh,
  });
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">{t("pages.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("pages.hint")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(pages.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("pages.empty")}</p>
        ) : (
          pages.data?.map((page) => (
            <Badge key={page.pageId} variant="outline" className="gap-2">
              {page.pageName} · {t(`pages.${page.kind}`)}
              <button
                type="button"
                aria-label={t("pages.remove")}
                onClick={() => remove.mutate(page.pageId)}
              >
                ×
              </button>
            </Badge>
          ))
        )}
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (/^\d+$/.test(pageId) && pageName.trim()) add.mutate();
        }}
      >
        <Input
          className="w-40"
          placeholder={t("pages.pageId")}
          aria-label={t("pages.pageId")}
          value={pageId}
          onChange={(event) => setPageId(event.target.value.trim())}
        />
        <Input
          className="w-56"
          placeholder={t("pages.pageName")}
          aria-label={t("pages.pageName")}
          value={pageName}
          onChange={(event) => setPageName(event.target.value)}
        />
        <select
          className="rounded-md border bg-background px-2 text-sm"
          aria-label={t("pages.kind")}
          value={kind}
          onChange={(event) =>
            setKind(event.target.value === "similar" ? "similar" : "competitor")
          }
        >
          <option value="competitor">{t("pages.competitor")}</option>
          <option value="similar">{t("pages.similar")}</option>
        </select>
        <Button type="submit" size="sm" pending={add.isPending}>
          {t("pages.add")}
        </Button>
      </form>
    </div>
  );
}

export function AdArchivePanel({ projectId }: { projectId: string }) {
  const { t } = useTranslation("ads");
  const queryClient = useQueryClient();
  const [winnersOnly, setWinnersOnly] = useState(false);
  const ads = useQuery({
    queryKey: [...adsQueryKey(projectId), "archive"],
    queryFn: () => listCompetitorAds({ data: { projectId } }),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      deleteCompetitorAd({ data: { projectId, assetId: id } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adsQueryKey(projectId) }),
  });
  const rows = (ads.data ?? []).filter((ad) => !winnersOnly || ad.winner);
  return (
    <div className="space-y-4">
      <AdPages projectId={projectId} />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={winnersOnly}
          onChange={(event) => setWinnersOnly(event.target.checked)}
        />
        {t("archive.winnersOnly")}
      </label>
      {ads.isPending ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("archive.empty")}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((ad) => (
            <article
              key={ad.id}
              className="space-y-2 rounded-lg border p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{ad.pageName}</span>
                <Badge variant="outline">
                  {t(`archive.format.${ad.format}`)}
                </Badge>
                {ad.winner ? <Badge>{t("archive.winner")}</Badge> : null}
                <span className="text-xs text-muted-foreground">
                  {ad.daysRunning !== null
                    ? t("archive.days", { count: ad.daysRunning })
                    : ""}{" "}
                  · {ad.active ? t("archive.active") : t("archive.inactive")}
                </span>
              </div>
              {ad.headline ? (
                <p className="font-medium">{ad.headline}</p>
              ) : null}
              {ad.body ? (
                <p className="line-clamp-4 whitespace-pre-line text-muted-foreground">
                  {ad.body}
                </p>
              ) : null}
              <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-xs">
                {ad.hook ? (
                  <>
                    <dt className="text-muted-foreground">
                      {t("archive.hook")}
                    </dt>
                    <dd>{ad.hook}</dd>
                  </>
                ) : null}
                {ad.angle ? (
                  <>
                    <dt className="text-muted-foreground">
                      {t("archive.angle")}
                    </dt>
                    <dd>{ad.angle}</dd>
                  </>
                ) : null}
                {ad.offer ? (
                  <>
                    <dt className="text-muted-foreground">
                      {t("archive.offer")}
                    </dt>
                    <dd>{ad.offer}</dd>
                  </>
                ) : null}
                {ad.cta ? (
                  <>
                    <dt className="text-muted-foreground">
                      {t("archive.cta")}
                    </dt>
                    <dd>{ad.cta}</dd>
                  </>
                ) : null}
                {ad.sceneSummary ? (
                  <>
                    <dt className="text-muted-foreground">
                      {t("archive.scenes")}
                    </dt>
                    <dd className="line-clamp-3">{ad.sceneSummary}</dd>
                  </>
                ) : null}
              </dl>
              <div className="flex items-center justify-between">
                <a
                  href={ad.snapshotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs underline"
                >
                  <ExternalLink className="size-3" />
                  {t("archive.snapshot")}
                </a>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t("archive.delete")}
                  onClick={() => remove.mutate(ad.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdReportPanel({ projectId }: { projectId: string }) {
  const { t } = useTranslation("ads");
  const report = useQuery({
    queryKey: [...adsQueryKey(projectId), "report"],
    queryFn: () => getAdReport({ data: { projectId } }),
  });
  if (report.isPending) return <Skeleton className="h-64" />;
  if (!report.data || report.data.report.total === 0)
    return <p className="text-sm text-muted-foreground">{t("report.empty")}</p>;
  return (
    <div className="rounded-lg border p-4 text-sm">
      <Markdown>{report.data.markdown}</Markdown>
    </div>
  );
}
