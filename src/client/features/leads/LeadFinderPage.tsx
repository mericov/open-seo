import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { QueryError } from "@/client/components/QueryState";
import { SkeletonPage } from "@/client/components/SkeletonPresets";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import {
  leadCategoriesOptions,
  leadSearchesOptions,
  leadsQueryKey,
} from "@/client/features/leads/leadQueries";
import { formatRelativeTime } from "@/client/lib/relative-time";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  LeadLocationField,
  useLocationPicker,
} from "@/client/features/leads/LeadLocationField";
import { StoreSearchForm } from "@/client/features/leads/StoreSearchForm";
import { startLeadSearch } from "@/serverFunctions/leads";
import { LEAD_SEARCH_MAX_LIMIT } from "@/types/schemas/leads";

function useDebounced(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function NewSearchForm({ projectId }: { projectId: string }) {
  const { t } = useTranslation("leads");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [categoryInput, setCategoryInput] = useState("");
  const [category, setCategory] = useState("");
  const picker = useLocationPicker(projectId);
  const [radiusKm, setRadiusKm] = useState(25);
  const [limit, setLimit] = useState(30);
  const [minRating, setMinRating] = useState("");
  const [nameQuery, setNameQuery] = useState("");

  const debouncedCategory = useDebounced(categoryInput, 250);
  const categoriesQuery = useQuery(
    leadCategoriesOptions(projectId, debouncedCategory),
  );

  const startMutation = useMutation({
    mutationFn: (place: {
      label: string;
      latitude: number;
      longitude: number;
    }) =>
      startLeadSearch({
        data: {
          projectId,
          category,
          location: picker.query,
          place,
          radiusKm,
          limit,
          nameQuery: nameQuery.trim() || undefined,
          minRating: minRating ? Number(minRating) : undefined,
        },
      }),
    onSuccess: async (result) => {
      toast.success(
        t("form.started", { found: result.found, added: result.added }),
      );
      await queryClient.invalidateQueries({
        queryKey: leadsQueryKey(projectId),
      });
      await navigate({
        to: "/p/$projectId/leads",
        params: { projectId },
        search: { search: result.searchId },
      });
    },
  });

  const showSuggestions =
    categoryInput.trim().length >= 2 && categoryInput !== category;

  return (
    <form
      className="space-y-4 rounded-xl border border-border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void picker
          .resolve()
          .then((place) => {
            if (place) startMutation.mutate(place);
          })
          .catch(() => undefined);
      }}
    >
      <h2 className="font-semibold">{t("form.title")}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="lead-category">{t("form.category")}</FieldLabel>
          <Input
            id="lead-category"
            autoComplete="off"
            placeholder={t("form.categoryPlaceholder")}
            value={categoryInput}
            onChange={(event) => {
              setCategoryInput(event.target.value);
              setCategory("");
            }}
          />
          {category ? (
            <FieldDescription>
              {t("form.categorySelected", { category })}
            </FieldDescription>
          ) : (
            <FieldDescription>{t("form.categoryHint")}</FieldDescription>
          )}
          {showSuggestions && categoriesQuery.data ? (
            categoriesQuery.data.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("form.noCategories")}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {categoriesQuery.data.map((item) => (
                  <button
                    key={item.category}
                    type="button"
                    className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => {
                      setCategory(item.category);
                      setCategoryInput(item.category);
                    }}
                  >
                    {item.category}
                    {item.businessCount != null ? (
                      <span className="ml-1 text-muted-foreground">
                        {item.businessCount.toLocaleString()}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )
          ) : null}
        </Field>
        <LeadLocationField picker={picker} />
        <Field>
          <FieldLabel htmlFor="lead-radius">{t("form.radius")}</FieldLabel>
          <Input
            id="lead-radius"
            type="number"
            min={1}
            max={100}
            value={radiusKm}
            onChange={(event) => setRadiusKm(Number(event.target.value) || 1)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="lead-limit">{t("form.limit")}</FieldLabel>
          <Input
            id="lead-limit"
            type="number"
            min={1}
            max={LEAD_SEARCH_MAX_LIMIT}
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value) || 1)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="lead-min-rating">
            {t("form.minRating")}
          </FieldLabel>
          <Input
            id="lead-min-rating"
            type="number"
            min={1}
            max={5}
            step={0.5}
            placeholder={t("form.anyRating")}
            value={minRating}
            onChange={(event) => setMinRating(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="lead-name-query">
            {t("form.nameQuery")}
          </FieldLabel>
          <Input
            id="lead-name-query"
            autoComplete="off"
            value={nameQuery}
            onChange={(event) => setNameQuery(event.target.value)}
          />
        </Field>
      </div>
      {startMutation.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {getStandardErrorMessage(startMutation.error)}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          pending={startMutation.isPending || picker.lookup.isPending}
          disabled={!category || picker.query.trim().length < 2}
        >
          {t("form.submit")}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t("form.costNote")}
        </span>
      </div>
    </form>
  );
}

export function LeadFinderPage({ projectId }: { projectId: string }) {
  const { t } = useTranslation("leads");
  const searchesQuery = useQuery(leadSearchesOptions(projectId));
  const [source, setSource] = useState<"local" | "shopify">("local");

  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title={t("title")} description={t("description")} />
        <div className="space-y-3">
          <Tabs
            value={source}
            onValueChange={(value) => setSource(value as "local" | "shopify")}
          >
            <TabsList>
              <TabsTrigger value="local">{t("sources.local")}</TabsTrigger>
              <TabsTrigger value="shopify">{t("sources.shopify")}</TabsTrigger>
            </TabsList>
          </Tabs>
          {source === "local" ? (
            <NewSearchForm projectId={projectId} />
          ) : (
            <StoreSearchForm projectId={projectId} />
          )}
        </div>
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t("list.title")}
          </h2>
          {searchesQuery.isPending ? (
            <SkeletonPage />
          ) : searchesQuery.isError ? (
            <QueryError
              error={searchesQuery.error}
              fallback={t("detail.loadFailed")}
              onRetry={() => void searchesQuery.refetch()}
              isRetrying={searchesQuery.isFetching}
            />
          ) : searchesQuery.data.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t("list.empty")}
              description={t("list.emptyDescription")}
            />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {searchesQuery.data.map((search) => (
                <li key={search.id}>
                  <Link
                    to="/p/$projectId/leads"
                    params={{ projectId }}
                    search={{ search: search.id }}
                    className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{search.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t("list.summary", {
                          total: search.total,
                          ready: search.ready,
                        })}{" "}
                        · {formatRelativeTime(search.updatedAt)}
                      </p>
                    </div>
                    {search.pending > 0 ? (
                      <Badge
                        variant="warning"
                        className="self-start sm:self-center"
                      >
                        {t("list.pending", { count: search.pending })}
                      </Badge>
                    ) : (
                      <Badge
                        variant="success"
                        className="self-start sm:self-center"
                      >
                        {t("list.ready", { count: search.ready })}
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
