import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import {
  leadCategoriesOptions,
  leadsQueryKey,
} from "@/client/features/leads/leadQueries";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  LeadLocationField,
  useLocationPicker,
} from "@/client/features/leads/LeadLocationField";
import { OptionSelect } from "@/client/features/leads/OptionSelect";
import { Tabs, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { startLeadSearch } from "@/serverFunctions/leads";
import {
  LEAD_CATEGORY_GROUP_KEYS,
  LEAD_NEED_FILTERS,
  type LeadCategoryGroup,
  type LeadNeedFilter,
} from "@/shared/leadScan";
import { LEAD_SEARCH_MAX_LIMIT } from "@/types/schemas/leads";

const NEED_OPTIONS = ["any", ...LEAD_NEED_FILTERS] as const;

function useDebounced(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function LocalSearchForm({ projectId }: { projectId: string }) {
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
  const [scope, setScope] = useState<"category" | "group">("category");
  const [group, setGroup] = useState<LeadCategoryGroup>("all");
  const [need, setNeed] = useState<LeadNeedFilter | "any">("any");

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
          category: scope === "category" ? category : undefined,
          categoryGroup: scope === "group" ? group : undefined,
          needFilter: need === "any" ? undefined : need,
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
      <Tabs
        value={scope}
        onValueChange={(value) => setScope(value as "category" | "group")}
      >
        <TabsList variant="line">
          <TabsTrigger value="category">{t("scan.byCategory")}</TabsTrigger>
          <TabsTrigger value="group">{t("scan.byGroup")}</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid gap-4 md:grid-cols-2">
        {scope === "group" ? (
          <OptionSelect
            id="lead-group"
            label={t("scan.group")}
            value={group}
            options={LEAD_CATEGORY_GROUP_KEYS}
            optionLabel={(key) => t(`scan.groups.${key}`)}
            onChange={setGroup}
          />
        ) : (
          <Field>
            <FieldLabel htmlFor="lead-category">
              {t("form.category")}
            </FieldLabel>
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
        )}
        <OptionSelect
          id="lead-need"
          label={t("scan.need")}
          value={need}
          options={NEED_OPTIONS}
          optionLabel={(key) => t(`scan.needs.${key}`)}
          onChange={setNeed}
        />
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
          disabled={
            (scope === "category" && !category) ||
            picker.query.trim().length < 2
          }
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
