import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, ExternalLink, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/client/components/ui/button";
import {
  leadsQueryKey,
  type ProjectLeadRow,
} from "@/client/features/leads/leadQueries";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { saveLeadReport } from "@/serverFunctions/leads";
import { LEAD_REPORT_PATH } from "@/shared/leadEmail";

const REPORT_TIMEOUT_MS = 180_000;

function useExtensionVersion() {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    const read = () =>
      setVersion(document.documentElement.dataset.seoGeoExtension ?? null);
    read();
    const timer = window.setTimeout(read, 1000);
    return () => window.clearTimeout(timer);
  }, []);
  return version;
}

function requestReport(url: string, lang: string): Promise<string> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("timeout"));
    }, REPORT_TIMEOUT_MS);
    function onMessage(event: MessageEvent) {
      const data: unknown = event.data;
      if (
        event.source !== window ||
        typeof data !== "object" ||
        data === null ||
        !("source" in data) ||
        data.source !== "seo-geo-extension" ||
        !("requestId" in data) ||
        data.requestId !== requestId
      ) {
        return;
      }
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      if (
        "ok" in data &&
        data.ok &&
        "html" in data &&
        typeof data.html === "string"
      ) {
        resolve(data.html);
      } else {
        reject(
          new Error(
            "error" in data && typeof data.error === "string"
              ? data.error
              : "failed",
          ),
        );
      }
    }
    window.addEventListener("message", onMessage);
    window.postMessage(
      { source: "mericseo", type: "seo-geo-report", requestId, url, lang },
      window.location.origin,
    );
  });
}

export function reportUrlFor(token: string | null) {
  return token ? `${window.location.origin}${LEAD_REPORT_PATH}${token}` : null;
}

function ReportViews({ lead }: { lead: ProjectLeadRow }) {
  const { t, i18n } = useTranslation("leads");
  const date = lead.reportLastViewedAt
    ? new Date(lead.reportLastViewedAt).toLocaleDateString(i18n.language, {
        month: "short",
        day: "numeric",
      })
    : "";
  const opened = lead.reportViews > 0;
  return (
    <span
      title={
        opened
          ? t("report.views", { count: lead.reportViews, date })
          : t("report.notViewed")
      }
      className={
        opened
          ? "inline-flex items-center gap-1 text-xs font-medium tabular-nums text-emerald-600"
          : "inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground/60"
      }
    >
      <Eye className="size-3.5" />
      {lead.reportViews}
    </span>
  );
}

export function ReportButton({
  projectId,
  lead,
}: {
  projectId: string;
  lead: ProjectLeadRow;
}) {
  const { t } = useTranslation("leads");
  const queryClient = useQueryClient();
  const version = useExtensionVersion();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!lead.website) throw new Error("no-website");
      const html = await requestReport(lead.website, lead.language);
      return saveLeadReport({ data: { projectId, leadId: lead.id, html } });
    },
    onSuccess: async () => {
      toast.success(t("report.ready"));
      await queryClient.invalidateQueries({
        queryKey: leadsQueryKey(projectId),
      });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error && error.message === "timeout"
          ? t("report.timeout")
          : `${t("report.failed")} ${getStandardErrorMessage(error)}`,
      ),
  });

  if (!lead.website) return null;
  const url = reportUrlFor(lead.reportToken);

  return (
    <div className="flex shrink-0 items-center gap-1">
      {url ? (
        <Button
          size="icon-sm"
          variant="ghost"
          className="rounded-full"
          aria-label={t("report.open")}
          title={t("report.open")}
          render={
            <a href={`${url}?preview`} target="_blank" rel="noreferrer" />
          }
        >
          <ExternalLink />
        </Button>
      ) : null}
      {url ? <ReportViews lead={lead} /> : null}
      {url ? (
        <Button
          size="icon-sm"
          variant="ghost"
          className="rounded-full"
          disabled={!version}
          aria-label={t("report.refresh")}
          title={
            version
              ? `${t("report.refresh")} · ${t("report.hint")}`
              : t("report.needsExtension")
          }
          pending={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          <RefreshCw />
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full"
          disabled={!version}
          title={version ? t("report.hint") : t("report.needsExtension")}
          pending={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          <FileText data-icon="inline-start" />
          {t("report.create")}
        </Button>
      )}
    </div>
  );
}
