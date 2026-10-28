import { useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/client/components/FormDialog";
import { QueryError } from "@/client/components/QueryState";
import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import { SkeletonTableRows } from "@/client/components/SkeletonPresets";
import { Button } from "@/client/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { Textarea } from "@/client/components/ui/textarea";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { shopifyQueryKey } from "@/client/features/shopify/shopifyQueries";
import { listShopifySeo, updateShopifySeo } from "@/serverFunctions/shopify";
import {
  SHOPIFY_SEO_RESOURCES,
  type ShopifySeoResource,
} from "@/shared/shopify";

type SeoItem = Awaited<ReturnType<typeof listShopifySeo>>["items"][number];

export function ShopifySeoTab({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}) {
  const { t } = useTranslation("shopify");
  const [resource, setResource] = useState<ShopifySeoResource>("product");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [editing, setEditing] = useState<SeoItem | null>(null);

  const query = useInfiniteQuery({
    queryKey: [...shopifyQueryKey(projectId), "seo", resource, submittedSearch],
    queryFn: ({ pageParam }) =>
      listShopifySeo({
        data: {
          projectId,
          resource,
          search: submittedSearch || undefined,
          after: pageParam,
        },
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedToggle
          showLabels
          value={resource}
          onChange={setResource}
          items={SHOPIFY_SEO_RESOURCES.map((value) => ({
            value,
            icon: null,
            label: t(`seo.resource.${value}`),
          }))}
        />
        <form
          className="w-full sm:w-64"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmittedSearch(search.trim());
          }}
        >
          <Input
            placeholder={t("seo.search")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </form>
      </div>

      {query.isError ? (
        <QueryError
          fallback={t("seo.loadError")}
          error={query.error}
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      ) : query.isPending ? (
        <SkeletonTableRows rows={8} columns={4} />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("seo.nothing")}</p>
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("seo.name")}</TableHead>
                <TableHead>{t("seo.seoTitle")}</TableHead>
                <TableHead>{t("seo.seoDescription")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-56">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.path}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-72 whitespace-normal text-sm">
                    {item.seoTitle ?? (
                      <span className="text-muted-foreground">
                        {t("seo.empty")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-96 whitespace-normal text-sm">
                    {item.seoDescription ?? (
                      <span className="text-muted-foreground">
                        {t("seo.empty")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t("seo.edit")}
                        onClick={() => setEditing(item)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}

      {query.hasNextPage ? (
        <Button
          variant="outline"
          size="sm"
          pending={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {t("seo.loadMore")}
        </Button>
      ) : null}

      {editing ? (
        <SeoEditDialog
          projectId={projectId}
          item={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function SeoEditDialog({
  projectId,
  item,
  onClose,
}: {
  projectId: string;
  item: SeoItem;
  onClose: () => void;
}) {
  const { t } = useTranslation(["shopify", "common"]);
  const queryClient = useQueryClient();
  const [seoTitle, setSeoTitle] = useState(item.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(
    item.seoDescription ?? "",
  );

  const mutation = useMutation({
    mutationFn: () =>
      updateShopifySeo({
        data: {
          projectId,
          updates: [{ id: item.id, seoTitle, seoDescription }],
        },
      }),
    meta: { errorToast: false },
    onSuccess: async (response) => {
      if (!response.ok) {
        toast.error(response.message);
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: [...shopifyQueryKey(projectId), "seo"],
      });
      toast.success(t("seo.saved"));
      onClose();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  return (
    <FormDialog
      title={t("seo.editTitle", { name: item.title })}
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
            onClick={() => mutation.mutate()}
          >
            {t("seo.save")}
          </Button>
        </>
      }
    >
      <Field>
        <FieldLabel htmlFor="shopify-seo-title">{t("seo.seoTitle")}</FieldLabel>
        <Input
          id="shopify-seo-title"
          value={seoTitle}
          maxLength={255}
          onChange={(event) => setSeoTitle(event.target.value)}
        />
        <FieldDescription>
          {t("seo.characters", { count: seoTitle.length })}
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="shopify-seo-description">
          {t("seo.seoDescription")}
        </FieldLabel>
        <Textarea
          id="shopify-seo-description"
          rows={4}
          value={seoDescription}
          maxLength={1000}
          onChange={(event) => setSeoDescription(event.target.value)}
        />
        <FieldDescription>
          {t("seo.characters", { count: seoDescription.length })}
        </FieldDescription>
      </Field>
    </FormDialog>
  );
}
