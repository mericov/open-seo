import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { sort } from "remeda";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { FormDialog } from "@/client/components/FormDialog";
import { QueryError } from "@/client/components/QueryState";
import { SafeExternalLink } from "@/client/components/SafeExternalLink";
import { SkeletonTableRows } from "@/client/components/SkeletonPresets";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  formatShopifyDate,
  shopifyQueryKey,
  shopifyThemesOptions,
} from "@/client/features/shopify/shopifyQueries";
import {
  createShopifyThemeCopy,
  type listShopifyThemes,
  publishShopifyTheme,
} from "@/serverFunctions/shopify";

type Theme = Awaited<ReturnType<typeof listShopifyThemes>>[number];

const linkClass =
  "inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground";

export function ShopifyThemesTab({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}) {
  const { t, i18n } = useTranslation("shopify");
  const queryClient = useQueryClient();
  const themesQuery = useQuery({
    ...shopifyThemesOptions(projectId),
    refetchInterval: (query) =>
      query.state.data?.some((theme) => theme.processing) ? 5000 : false,
  });
  const [creating, setCreating] = useState(false);
  const [publishing, setPublishing] = useState<Theme | null>(null);

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: [...shopifyQueryKey(projectId), "themes"],
    });

  const publishMutation = useMutation({
    mutationFn: (themeId: string) =>
      publishShopifyTheme({ data: { projectId, themeId } }),
    meta: { errorToast: false },
    onSuccess: async (response) => {
      setPublishing(null);
      if (!response.ok) {
        toast.error(response.message);
        return;
      }
      await refresh();
      toast.success(t("themes.published"));
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const themes = sort(
    themesQuery.data ?? [],
    (a, b) =>
      Number(b.role === "MAIN") - Number(a.role === "MAIN") ||
      (b.version ?? 0) - (a.version ?? 0) ||
      b.updatedAt.localeCompare(a.updatedAt),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl space-y-1">
          <p className="text-sm text-muted-foreground">{t("themes.intro")}</p>
          <p className="text-sm text-muted-foreground">
            {t("themes.claudeHint")}
          </p>
        </div>
        {canManage ? (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus data-icon="inline-start" />
            {t("themes.newCopy")}
          </Button>
        ) : null}
      </div>

      {themesQuery.isError ? (
        <QueryError
          fallback={t("themes.loadError")}
          error={themesQuery.error}
          onRetry={() => void themesQuery.refetch()}
          isRetrying={themesQuery.isFetching}
        />
      ) : themesQuery.isPending ? (
        <SkeletonTableRows rows={4} columns={3} />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {themes.map((theme) => (
            <li
              key={theme.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{theme.name}</p>
                  {theme.role === "MAIN" ? (
                    <Badge>{t("themes.live")}</Badge>
                  ) : theme.isMericSeoCopy ? (
                    <Badge variant="secondary">{t("themes.copy")}</Badge>
                  ) : (
                    <Badge variant="outline">{t("themes.other")}</Badge>
                  )}
                  {theme.processing ? (
                    <span className="text-xs text-muted-foreground">
                      {t("themes.processing")}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("themes.updated", {
                    date: formatShopifyDate(theme.updatedAt, i18n.language),
                  })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <SafeExternalLink
                  url={theme.previewUrl}
                  label={t("themes.preview")}
                  className={linkClass}
                />
                <SafeExternalLink
                  url={theme.editorUrl}
                  label={t("themes.editor")}
                  className={linkClass}
                />
                {canManage && theme.role !== "MAIN" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={theme.processing}
                    onClick={() => setPublishing(theme)}
                  >
                    {t("themes.publish")}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <CreateCopyDialog
          projectId={projectId}
          onClose={() => setCreating(false)}
          onCreated={refresh}
        />
      ) : null}
      {publishing ? (
        <ConfirmDialog
          title={t("themes.publishConfirm", { name: publishing.name })}
          confirmLabel={t("themes.publish")}
          pending={publishMutation.isPending}
          onConfirm={() => publishMutation.mutate(publishing.id)}
          onClose={() => setPublishing(null)}
        >
          {t("themes.publishDescription")}
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function CreateCopyDialog({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const { t } = useTranslation(["shopify", "common"]);
  const [summary, setSummary] = useState("");
  const mutation = useMutation({
    mutationFn: () => createShopifyThemeCopy({ data: { projectId, summary } }),
    meta: { errorToast: false },
    onSuccess: async (response) => {
      if (!response.ok) {
        toast.error(response.message);
        return;
      }
      await onCreated();
      toast.success(t("themes.created"));
      onClose();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  return (
    <FormDialog
      title={t("themes.newCopyTitle")}
      onClose={onClose}
      actions={
        <>
          <Button
            variant="ghost"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            {t("common:actions.cancel")}
          </Button>
          <Button
            pending={mutation.isPending}
            disabled={!summary.trim()}
            onClick={() => mutation.mutate()}
          >
            {t("themes.create")}
          </Button>
        </>
      }
    >
      <Field>
        <FieldLabel htmlFor="shopify-theme-summary">
          {t("themes.summary")}
        </FieldLabel>
        <Input
          id="shopify-theme-summary"
          value={summary}
          maxLength={120}
          onChange={(event) => setSummary(event.target.value)}
        />
        <FieldDescription>{t("themes.summaryHint")}</FieldDescription>
      </Field>
    </FormDialog>
  );
}
