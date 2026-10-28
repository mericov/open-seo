import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import { Field, FieldLabel } from "@/client/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Skeleton } from "@/client/components/ui/skeleton";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { shopifyQueryKey } from "@/client/features/shopify/shopifyQueries";
import {
  getShopifyDraftPublishState,
  publishDraftToShopify,
} from "@/serverFunctions/shopify";

export function ShopifyPublishSection({
  projectId,
  draftId,
  onPublished,
}: {
  projectId: string;
  draftId: string;
  onPublished: () => Promise<void>;
}) {
  const { t } = useTranslation("shopify");
  const stateQuery = useQuery({
    queryKey: [...shopifyQueryKey(projectId), "publish", draftId],
    queryFn: () =>
      getShopifyDraftPublishState({ data: { projectId, draftId } }),
  });
  const state = stateQuery.data;
  const [pickedBlogId, setPickedBlogId] = useState<string | null>(null);

  const blogs = state?.connected ? state.blogs : [];
  const blogId =
    pickedBlogId ??
    (state?.connected ? (state.article?.blogId ?? blogs[0]?.id) : undefined) ??
    null;

  const mutation = useMutation({
    mutationFn: () =>
      publishDraftToShopify({
        data: {
          projectId,
          draftId,
          blogId: blogId ?? undefined,
          publish: true,
        },
      }),
    meta: { errorToast: false },
    onSuccess: async (response) => {
      if (!response.ok) {
        toast.error(response.message);
        return;
      }
      toast.success(t("publish.success"));
      await onPublished();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  if (stateQuery.isPending) return <Skeleton className="h-28" />;
  if (!state?.connected) return null;

  const items = blogs.map((blog) => ({ value: blog.id, label: blog.title }));

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-semibold">{t("publish.title")}</p>
        <p className="text-sm text-muted-foreground">
          {t("publish.description")}
        </p>
      </div>
      {blogs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("publish.noBlogs")}</p>
      ) : (
        <>
          {blogs.length > 1 ? (
            <Field>
              <FieldLabel>{t("publish.blog")}</FieldLabel>
              <Select
                items={items}
                value={blogId}
                onValueChange={(value) => {
                  if (typeof value === "string") setPickedBlogId(value);
                }}
              >
                <SelectTrigger aria-label={t("publish.blog")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {state.article ? (
            <p className="break-all text-xs text-muted-foreground">
              {t("publish.existing", { url: state.article.url })}
            </p>
          ) : null}
          <Button
            className="w-full"
            pending={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {state.article ? t("publish.update") : t("publish.submit")}
          </Button>
        </>
      )}
      <p className="text-xs text-muted-foreground">{t("publish.or")}</p>
    </div>
  );
}
