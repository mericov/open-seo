import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Tabs, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { Textarea } from "@/client/components/ui/textarea";
import { leadsQueryKey } from "@/client/features/leads/leadQueries";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { OptionSelect } from "@/client/features/leads/OptionSelect";
import { importStores, startStoreSearch } from "@/serverFunctions/leads";
import {
  LEAD_STORE_PLATFORMS,
  type LeadStorePlatform,
} from "@/shared/leadScan";
import { LEAD_SEARCH_MAX_LIMIT } from "@/types/schemas/leads";

const COUNTRIES = [
  "any",
  "TR",
  "US",
  "GB",
  "DE",
  "NL",
  "FR",
  "CA",
  "AU",
  "AE",
] as const;
type Country = (typeof COUNTRIES)[number];

type Mode = "discover" | "import";

export function StoreSearchForm({ projectId }: { projectId: string }) {
  const { t } = useTranslation("leads");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("discover");
  const [keywords, setKeywords] = useState("");
  const [country, setCountry] = useState<Country>("TR");
  const [platform, setPlatform] = useState<LeadStorePlatform>("Shopify");
  const [maxRank, setMaxRank] = useState("");
  const [limit, setLimit] = useState(30);
  const [domains, setDomains] = useState("");

  const keywordList = keywords
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 10);

  const startMutation = useMutation({
    mutationFn: () =>
      mode === "import"
        ? importStores({ data: { projectId, domains } })
        : startStoreSearch({
            data: {
              projectId,
              technology: platform,
              keywords: keywordList,
              countryCode: country === "any" ? undefined : country,
              maxRank: maxRank ? Number(maxRank) : undefined,
              limit,
            },
          }),
    onSuccess: async (result) => {
      toast.success(
        t("stores.started", { found: result.found, added: result.added }),
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

  const canSubmit =
    mode === "import"
      ? domains.trim().length >= 3
      : keywordList.length > 0 || country !== "any";

  return (
    <form
      className="space-y-4 rounded-xl border border-border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        startMutation.mutate();
      }}
    >
      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList variant="line">
          <TabsTrigger value="discover">{t("stores.discover")}</TabsTrigger>
          <TabsTrigger value="import">{t("stores.import")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "import" ? (
        <Field>
          <FieldLabel htmlFor="store-domains">{t("stores.domains")}</FieldLabel>
          <Textarea
            id="store-domains"
            rows={6}
            placeholder={"amaviflowers.com\nexample-store.com"}
            value={domains}
            onChange={(event) => setDomains(event.target.value)}
          />
          <FieldDescription>{t("stores.domainsHint")}</FieldDescription>
        </Field>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="store-keywords">
              {t("stores.keywords")}
            </FieldLabel>
            <Input
              id="store-keywords"
              autoComplete="off"
              placeholder={t("stores.keywordsPlaceholder")}
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
            />
            <FieldDescription>{t("stores.keywordsHint")}</FieldDescription>
          </Field>
          <OptionSelect
            id="store-platform"
            label={t("stores.platform")}
            value={platform}
            options={LEAD_STORE_PLATFORMS}
            optionLabel={(value) => value}
            onChange={setPlatform}
          />
          <OptionSelect
            id="store-country"
            label={t("stores.country")}
            value={country}
            options={COUNTRIES}
            optionLabel={(code) => t(`stores.countries.${code}`)}
            onChange={setCountry}
          />
          <Field>
            <FieldLabel htmlFor="store-max-rank">
              {t("stores.maxRank")}
            </FieldLabel>
            <Input
              id="store-max-rank"
              type="number"
              min={0}
              max={1000}
              placeholder={t("stores.anyRank")}
              value={maxRank}
              onChange={(event) => setMaxRank(event.target.value)}
            />
            <FieldDescription>{t("stores.maxRankHint")}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="store-limit">{t("stores.limit")}</FieldLabel>
            <Input
              id="store-limit"
              type="number"
              min={1}
              max={LEAD_SEARCH_MAX_LIMIT}
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value) || 1)}
            />
          </Field>
        </div>
      )}

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
          pending={startMutation.isPending}
          disabled={!canSubmit}
        >
          {mode === "import" ? t("stores.submitImport") : t("stores.submit")}
        </Button>
        <span className="text-xs text-muted-foreground">
          {mode === "import"
            ? t("stores.importCostNote")
            : t("stores.costNote", {
                cost: (0.012 + limit * 0.0012).toFixed(2),
              })}
        </span>
      </div>
    </form>
  );
}
