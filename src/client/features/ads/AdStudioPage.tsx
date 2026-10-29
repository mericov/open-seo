import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/client/components/FormDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { Skeleton } from "@/client/components/ui/skeleton";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  AdArchivePanel,
  AdReportPanel,
  adsQueryKey,
} from "@/client/features/ads/AdArchivePanel";
import { AdDraftEditor } from "@/client/features/ads/AdDraftEditor";
import type { AdDraftView } from "@/client/features/ads/AdDraftParts";
import { useProjectMarket } from "@/client/features/projects/useProjectMarket";
import { listAdDrafts, sendAdDraft } from "@/serverFunctions/ads";
import { TURKEY_LOCATION_CODE } from "@/shared/social";

export const AD_TABS = ["drafts", "archive", "report"] as const;

function SendDialog({
  projectId,
  draft,
  onClose,
}: {
  projectId: string;
  draft: AdDraftView;
  onClose: () => void;
}) {
  const { t } = useTranslation(["ads", "common"]);
  const queryClient = useQueryClient();
  const market = useProjectMarket(projectId);
  const [campaignId, setCampaignId] = useState(draft.metaCampaignId ?? "");
  const [budget, setBudget] = useState("");
  const [countries, setCountries] = useState(
    market?.locationCode === TURKEY_LOCATION_CODE ? "TR" : "US",
  );
  const send = useMutation({
    mutationFn: () =>
      sendAdDraft({
        data: {
          projectId,
          draftId: draft.id,
          campaignId: campaignId.trim() || undefined,
          dailyBudget: budget ? Number(budget) : undefined,
          countries: countries
            .split(",")
            .map((code) => code.trim().toUpperCase())
            .filter((code) => code.length === 2),
        },
      }),
    meta: { errorToast: false },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: adsQueryKey(projectId) });
      if (!response.ok) {
        toast.error(response.message);
        return;
      }
      toast.success(t("send.sent"));
      window.open(response.result.adsManagerUrl, "_blank", "noopener");
      onClose();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });
  return (
    <FormDialog
      title={t("send.title")}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button pending={send.isPending} onClick={() => send.mutate()}>
            {t("send.confirm")}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">{t("send.body")}</p>
      <Field>
        <FieldLabel htmlFor="send-campaign">{t("send.campaignId")}</FieldLabel>
        <Input
          id="send-campaign"
          inputMode="numeric"
          value={campaignId}
          onChange={(event) =>
            setCampaignId(event.target.value.replace(/\D/g, ""))
          }
        />
        <FieldDescription>{t("send.campaignHint")}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="send-budget">{t("send.budget")}</FieldLabel>
        <Input
          id="send-budget"
          inputMode="numeric"
          value={budget}
          onChange={(event) => setBudget(event.target.value.replace(/\D/g, ""))}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="send-countries">{t("send.countries")}</FieldLabel>
        <Input
          id="send-countries"
          value={countries}
          onChange={(event) => setCountries(event.target.value)}
        />
        <FieldDescription>{t("send.countriesHint")}</FieldDescription>
      </Field>
    </FormDialog>
  );
}

function AdDraftsPanel({ projectId }: { projectId: string }) {
  const { t } = useTranslation("ads");
  const drafts = useQuery({
    queryKey: [...adsQueryKey(projectId), "drafts"],
    queryFn: () => listAdDrafts({ data: { projectId } }),
  });
  const [editing, setEditing] = useState<{ draft: AdDraftView | null } | null>(
    null,
  );
  const [sending, setSending] = useState<AdDraftView | null>(null);
  return (
    <div className="space-y-4">
      <Button size="sm" onClick={() => setEditing({ draft: null })}>
        <Plus className="size-4" />
        {t("drafts.new")}
      </Button>
      {drafts.isPending ? (
        <Skeleton className="h-64" />
      ) : (drafts.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("drafts.empty")}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {drafts.data?.map((draft) => (
            <button
              key={draft.id}
              type="button"
              onClick={() => setEditing({ draft })}
              className="space-y-2 rounded-lg border p-3 text-left text-sm hover:bg-muted/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {t(`drafts.kind.${draft.kind}`)}
                </Badge>
                <Badge
                  variant={
                    draft.status === "failed" ? "destructive" : "secondary"
                  }
                >
                  {t(`drafts.status.${draft.status}`)}
                </Badge>
              </div>
              {draft.media[0] &&
              !draft.media[0].contentType.startsWith("video/") ? (
                <img
                  src={draft.media[0].url}
                  alt=""
                  className="aspect-square w-full rounded object-cover"
                />
              ) : null}
              <p className="font-medium">{draft.name}</p>
              <p className="line-clamp-3 text-muted-foreground">
                {draft.primaryTexts[0]}
              </p>
              {draft.metaAdId ? (
                <span className="inline-flex items-center gap-1 text-xs underline">
                  <ExternalLink className="size-3" />
                  {t("drafts.openInMeta")}: {draft.metaAdId}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}
      {editing ? (
        <AdDraftEditor
          projectId={projectId}
          draft={editing.draft}
          onClose={() => setEditing(null)}
          onSend={(draft) => {
            setEditing(null);
            setSending(draft);
          }}
        />
      ) : null}
      {sending ? (
        <SendDialog
          projectId={projectId}
          draft={sending}
          onClose={() => setSending(null)}
        />
      ) : null}
    </div>
  );
}

export function AdStudioPage({
  projectId,
  tab,
  onTabChange,
}: {
  projectId: string;
  tab: (typeof AD_TABS)[number];
  onTabChange: (tab: (typeof AD_TABS)[number]) => void;
}) {
  const { t } = useTranslation("ads");
  return (
    <div className="h-full overflow-auto bg-background px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader title={t("title")} description={t("description")} />
        <SegmentedToggle
          showLabels
          value={tab}
          onChange={onTabChange}
          items={AD_TABS.map((value) => ({
            value,
            icon: null,
            label: t(`tabs.${value}`),
          }))}
        />
        {tab === "drafts" ? (
          <AdDraftsPanel projectId={projectId} />
        ) : tab === "archive" ? (
          <AdArchivePanel projectId={projectId} />
        ) : (
          <AdReportPanel projectId={projectId} />
        )}
      </div>
    </div>
  );
}
