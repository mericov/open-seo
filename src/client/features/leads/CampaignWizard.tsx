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
import { Switch } from "@/client/components/ui/switch";
import { Textarea } from "@/client/components/ui/textarea";
import { useLocationPicker } from "@/client/features/leads/LeadLocationField";
import { leadsQueryKey } from "@/client/features/leads/leadQueries";
import {
  AreaStep,
  PresetStep,
  StoreStep,
  type Preset,
  type Scope,
} from "@/client/features/leads/CampaignWizardSteps";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { createLeadCampaign, importStores } from "@/serverFunctions/leads";
import type { LeadAreaCountry } from "@/shared/leadAreas";
import {
  LEAD_RUN_SIZE_MAX,
  type LeadCategoryGroup,
  type LeadNeedFilter,
  type LeadStorePlatform,
} from "@/shared/leadScan";

export function CampaignWizard({
  projectId,
  onCancel,
}: {
  projectId: string;
  onCancel?: () => void;
}) {
  const { t } = useTranslation("leads");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [preset, setPreset] = useState<Preset>("product_b2b");
  const [scope, setScope] = useState<Scope>("country");
  const [country, setCountry] = useState<LeadAreaCountry>("US");
  const picker = useLocationPicker(projectId);
  const [radiusKm, setRadiusKm] = useState(30);
  const [group, setGroup] = useState<LeadCategoryGroup>("all");
  const [need, setNeed] = useState<LeadNeedFilter | "any">("any");
  const [keywords, setKeywords] = useState("");
  const [platform, setPlatform] = useState<LeadStorePlatform>("Shopify");
  const [maxRank, setMaxRank] = useState("");
  const [domains, setDomains] = useState("");
  const [weeklyTarget, setWeeklyTarget] = useState(25);
  const [autoRun, setAutoRun] = useState(true);

  const openCampaign = async (searchId: string) => {
    await queryClient.invalidateQueries({ queryKey: leadsQueryKey(projectId) });
    await navigate({
      to: "/p/$projectId/leads",
      params: { projectId },
      search: { search: searchId },
    });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (preset === "import") {
        return importStores({ data: { projectId, domains } });
      }
      const pool = {
        projectId,
        weeklyTarget: Math.min(
          LEAD_RUN_SIZE_MAX,
          Math.max(5, weeklyTarget || 5),
        ),
        autoRun,
      };
      if (preset === "shopify_service") {
        return createLeadCampaign({
          data: {
            ...pool,
            preset,
            technology: platform,
            countryCode: country,
            keywords: keywords
              .split(",")
              .map((word) => word.trim())
              .filter(Boolean)
              .slice(0, 10),
            maxRank: maxRank ? Number(maxRank) : undefined,
          },
        });
      }
      if (scope === "place" && !picker.place) {
        throw new Error(t("form.noLocations"));
      }
      const area =
        scope === "place" && picker.place
          ? { scope, place: picker.place, radiusKm }
          : { scope: "country" as const, countryCode: country };
      return preset === "product_b2b"
        ? createLeadCampaign({ data: { ...pool, preset, area } })
        : createLeadCampaign({
            data: {
              ...pool,
              preset,
              area,
              categoryGroup: group,
              needFilter: need === "any" ? undefined : need,
            },
          });
    },
    onSuccess: async (result) => {
      toast.success(t("campaign.created", { added: result.added }));
      await openCampaign(result.searchId);
    },
  });

  const totalSteps = preset === "import" ? 2 : 3;
  const usesArea = preset === "product_b2b" || preset === "local_service";
  const whereReady =
    preset === "import"
      ? domains.trim().length >= 3
      : !usesArea || scope === "country" || picker.query.trim().length >= 2;
  const isLastStep = step === totalSteps;

  return (
    <form
      className="space-y-5 rounded-xl border border-border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (isLastStep) {
          createMutation.mutate();
        } else if (step === 2 && usesArea && scope === "place") {
          void picker
            .resolve()
            .then((place) => {
              if (place) setStep(3);
            })
            .catch(() => undefined);
        } else {
          setStep(step + 1);
        }
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">
          {step === 1
            ? t("campaign.presetTitle")
            : step === 2
              ? t("campaign.whereTitle")
              : t("campaign.targetTitle")}
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("campaign.step", { current: step, total: totalSteps })}
        </span>
      </div>

      {step === 1 ? <PresetStep preset={preset} setPreset={setPreset} /> : null}

      {step === 2 && preset === "import" ? (
        <Field>
          <FieldLabel htmlFor="campaign-domains">
            {t("stores.domains")}
          </FieldLabel>
          <Textarea
            id="campaign-domains"
            rows={6}
            placeholder={"example-store.com\nanother-store.com"}
            value={domains}
            onChange={(event) => setDomains(event.target.value)}
          />
          <FieldDescription>{t("stores.domainsHint")}</FieldDescription>
        </Field>
      ) : null}

      {step === 2 && preset === "shopify_service" ? (
        <StoreStep
          country={country}
          setCountry={setCountry}
          keywords={keywords}
          setKeywords={setKeywords}
          platform={platform}
          setPlatform={setPlatform}
          maxRank={maxRank}
          setMaxRank={setMaxRank}
        />
      ) : null}

      {step === 2 && usesArea ? (
        <AreaStep
          preset={preset}
          group={group}
          setGroup={setGroup}
          need={need}
          setNeed={setNeed}
          scope={scope}
          setScope={setScope}
          country={country}
          setCountry={setCountry}
          picker={picker}
          radiusKm={radiusKm}
          setRadiusKm={setRadiusKm}
        />
      ) : null}

      {step === 3 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="campaign-target">
              {t("campaign.target")}
            </FieldLabel>
            <Input
              id="campaign-target"
              type="number"
              min={5}
              max={LEAD_RUN_SIZE_MAX}
              value={weeklyTarget}
              onChange={(event) => setWeeklyTarget(Number(event.target.value))}
            />
            <FieldDescription>{t("campaign.targetHint")}</FieldDescription>
          </Field>
          <label className="inline-flex items-center gap-2 self-start text-sm md:mt-7">
            <Switch checked={autoRun} onCheckedChange={setAutoRun} />
            {t("campaign.weekly")}
          </label>
        </div>
      ) : null}

      {createMutation.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {getStandardErrorMessage(createMutation.error)}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {step > 1 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep(step - 1)}
          >
            {t("campaign.back")}
          </Button>
        ) : onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("campaign.cancel")}
          </Button>
        ) : null}
        <Button
          type="submit"
          pending={createMutation.isPending || picker.lookup.isPending}
          disabled={step === 2 && !whereReady}
        >
          {isLastStep
            ? preset === "import"
              ? t("stores.submitImport")
              : t("campaign.create")
            : t("campaign.next")}
        </Button>
        {isLastStep ? (
          <span className="text-xs text-muted-foreground">
            {preset === "import"
              ? t("stores.importCostNote")
              : t("campaign.costNote")}
          </span>
        ) : null}
      </div>
    </form>
  );
}
