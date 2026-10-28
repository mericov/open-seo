import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FormDialog } from "@/client/components/FormDialog";
import { Button } from "@/client/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { blogTrackingQueryKey } from "@/client/features/blog-tracking/blogTrackingQueries";
import {
  blogWriterQueryKey,
  type BlogDraft,
} from "@/client/features/blog-writer/blogWriterQueries";
import { publishBlogDraft } from "@/serverFunctions/blogDrafts";
import { ShopifyPublishSection } from "@/client/features/shopify/ShopifyPublishSection";

export function BlogDraftPublishDialog({
  projectId,
  draft,
  siteDomain,
  onClose,
}: {
  projectId: string;
  draft: BlogDraft;
  siteDomain: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation(["blogWriter", "common"]);
  const queryClient = useQueryClient();
  const [url, setUrl] = useState(
    draft.publishedUrl ??
      (siteDomain && draft.slug
        ? `https://${siteDomain}/blogs/news/${draft.slug}`
        : ""),
  );

  const refreshDrafts = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: blogWriterQueryKey(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: blogTrackingQueryKey(projectId),
      }),
    ]);

  const mutation = useMutation({
    mutationFn: () =>
      publishBlogDraft({
        data: { projectId, id: draft.id, publishedUrl: url },
      }),
    meta: { errorToast: false },
    onSuccess: async () => {
      await refreshDrafts();
      toast.success(t("detail.published"));
      onClose();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  return (
    <FormDialog
      title={t("detail.publishTitle")}
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
            disabled={!url.trim()}
            onClick={() => mutation.mutate()}
          >
            {t("detail.publishSubmit")}
          </Button>
        </>
      }
    >
      <ShopifyPublishSection
        projectId={projectId}
        draftId={draft.id}
        onPublished={async () => {
          await refreshDrafts();
          onClose();
        }}
      />
      <Field>
        <FieldLabel htmlFor="draft-published-url">
          {t("detail.publishUrl")}
        </FieldLabel>
        <Input
          id="draft-published-url"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <FieldDescription>{t("detail.publishDescription")}</FieldDescription>
      </Field>
    </FormDialog>
  );
}
