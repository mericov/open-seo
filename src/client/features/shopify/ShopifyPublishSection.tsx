import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ShoppingBag } from "lucide-react";
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

function useShopifyDraftPublish(
  projectId: string,
  draftId: string,
  onPublished: () => Promise<unknown>,
) {
  const { t } = useTranslation("shopify");
  const queryClient = useQueryClient();
  const stateKey = [...shopifyQueryKey(projectId), "publish", draftId];
  const stateQuery = useQuery({
    queryKey: stateKey,
    queryFn: () =>
      getShopifyDraftPublishState({ data: { projectId, draftId } }),
  });

  const mutation = useMutation({
    mutationFn: (blogId: string | undefined) =>
      publishDraftToShopify({
        data: { projectId, draftId, blogId, publish: true },
      }),
    meta: { errorToast: false },
    onSuccess: async (response) => {
      if (!response.ok) {
        toast.error(response.message);
        return;
      }
      toast.success(t("publish.success"), {
        description: response.result.url,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: stateKey }),
        onPublished(),
      ]);
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  return {
    stateQuery,
    pending: mutation.isPending,
    publish: (blogId?: string) => mutation.mutate(blogId),
  };
}

export function ShopifyPublishButton({
  projectId,
  draftId,
  onPublished,
}: {
  projectId: string;
  draftId: string;
  onPublished: () => Promise<unknown>;
}) {
  const { t } = useTranslation("shopify");
  const { stateQuery, pending, publish } = useShopifyDraftPublish(
    projectId,
    draftId,
    onPublished,
  );
  const state = stateQuery.data;
  if (!state?.connected || state.blogs.length === 0) return null;
  return (
    <Button size="sm" pending={pending} onClick={() => publish()}>
      <ShoppingBag data-icon="inline-start" />
      {state.article ? t("publish.update") : t("publish.submit")}
    </Button>
  );
}

export function ShopifyPublishSection({
  projectId,
  draftId,
  onPublished,
}: {
  projectId: string;
  draftId: string;
  onPublished: () => Promise<unknown>;
}) {
  const { t } = useTranslation("shopify");
  const { stateQuery, pending, publish } = useShopifyDraftPublish(
    projectId,
    draftId,
    onPublished,
  );
  const state = stateQuery.data;
  const [pickedBlogId, setPickedBlogId] = useState<string | null>(null);

  if (stateQuery.isPending) return <Skeleton className="h-28" />;
  if (!state?.connected) return null;

  const blogs = state.blogs;
  const blogId = pickedBlogId ?? state.article?.blogId ?? blogs[0]?.id ?? null;
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
            pending={pending}
            onClick={() => publish(blogId ?? undefined)}
          >
            {state.article ? t("publish.update") : t("publish.submit")}
          </Button>
        </>
      )}
      <p className="text-xs text-muted-foreground">{t("publish.or")}</p>
    </div>
  );
}
