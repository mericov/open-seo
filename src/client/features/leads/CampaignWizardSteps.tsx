import { Building2, ClipboardList, MapPin, ShoppingBag } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import {
  LeadLocationField,
  type useLocationPicker,
} from "@/client/features/leads/LeadLocationField";
import { OptionSelect } from "@/client/features/leads/OptionSelect";
import { LEAD_AREA_COUNTRIES, type LeadAreaCountry } from "@/shared/leadAreas";
import {
  LEAD_CATEGORY_GROUP_KEYS,
  LEAD_NEED_FILTERS,
  LEAD_STORE_PLATFORMS,
  type LeadCategoryGroup,
  type LeadNeedFilter,
  type LeadStorePlatform,
} from "@/shared/leadScan";
import { cn } from "cn";

const PRESETS = [
  { key: "product_b2b", icon: Building2 },
  { key: "shopify_service", icon: ShoppingBag },
  { key: "local_service", icon: MapPin },
  { key: "import", icon: ClipboardList },
] as const;
export type Preset = (typeof PRESETS)[number]["key"];
const SCOPES = ["country", "place"] as const;
export type Scope = (typeof SCOPES)[number];
const NEED_OPTIONS = ["any", ...LEAD_NEED_FILTERS] as const;

export function PresetStep({
  preset,
  setPreset,
}: {
  preset: Preset;
  setPreset: (preset: Preset) => void;
}) {
  const { t } = useTranslation("leads");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {PRESETS.map(({ key, icon: Icon }) => (
        <button
          key={key}
          type="button"
          aria-pressed={preset === key}
          onClick={() => setPreset(key)}
          className={cn(
            "flex items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring",
            preset === key && "border-primary bg-muted/60",
          )}
        >
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="space-y-1">
            <span className="block text-sm font-medium">
              {t(`campaign.presets.${key}.title`)}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t(`campaign.presets.${key}.body`)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function StoreStep({
  country,
  setCountry,
  keywords,
  setKeywords,
  platform,
  setPlatform,
  maxRank,
  setMaxRank,
}: {
  country: LeadAreaCountry;
  setCountry: (value: LeadAreaCountry) => void;
  keywords: string;
  setKeywords: (value: string) => void;
  platform: LeadStorePlatform;
  setPlatform: (value: LeadStorePlatform) => void;
  maxRank: string;
  setMaxRank: (value: string) => void;
}) {
  const { t } = useTranslation("leads");
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CountrySelect value={country} onChange={setCountry} />
      <Field>
        <FieldLabel htmlFor="campaign-niche">{t("campaign.niche")}</FieldLabel>
        <Input
          id="campaign-niche"
          autoComplete="off"
          placeholder={t("stores.keywordsPlaceholder")}
          value={keywords}
          onChange={(event) => setKeywords(event.target.value)}
        />
        <FieldDescription>{t("campaign.nicheHint")}</FieldDescription>
      </Field>
      <details className="md:col-span-2">
        <summary className="cursor-pointer text-sm text-muted-foreground">
          {t("campaign.advanced")}
        </summary>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <OptionSelect
            id="campaign-platform"
            label={t("stores.platform")}
            value={platform}
            options={LEAD_STORE_PLATFORMS}
            optionLabel={(value) => value}
            onChange={setPlatform}
          />
          <Field>
            <FieldLabel htmlFor="campaign-max-rank">
              {t("stores.maxRank")}
            </FieldLabel>
            <Input
              id="campaign-max-rank"
              type="number"
              min={0}
              max={1000}
              placeholder={t("stores.anyRank")}
              value={maxRank}
              onChange={(event) => setMaxRank(event.target.value)}
            />
            <FieldDescription>{t("stores.maxRankHint")}</FieldDescription>
          </Field>
        </div>
      </details>
    </div>
  );
}

export function AreaStep({
  preset,
  group,
  setGroup,
  need,
  setNeed,
  scope,
  setScope,
  country,
  setCountry,
  picker,
  radiusKm,
  setRadiusKm,
}: {
  preset: Preset;
  group: LeadCategoryGroup;
  setGroup: (value: LeadCategoryGroup) => void;
  need: LeadNeedFilter | "any";
  setNeed: (value: LeadNeedFilter | "any") => void;
  scope: Scope;
  setScope: (value: Scope) => void;
  country: LeadAreaCountry;
  setCountry: (value: LeadAreaCountry) => void;
  picker: ReturnType<typeof useLocationPicker>;
  radiusKm: number;
  setRadiusKm: (value: number) => void;
}) {
  const { t } = useTranslation("leads");
  return (
    <div className="space-y-4">
      {preset === "local_service" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <OptionSelect
            id="campaign-sector"
            label={t("campaign.sector")}
            value={group}
            options={LEAD_CATEGORY_GROUP_KEYS}
            optionLabel={(key) => t(`scan.groups.${key}`)}
            onChange={setGroup}
          />
          <OptionSelect
            id="campaign-need"
            label={t("campaign.need")}
            value={need}
            options={NEED_OPTIONS}
            optionLabel={(key) => t(`scan.needs.${key}`)}
            onChange={setNeed}
          />
        </div>
      ) : null}
      <div className="inline-flex gap-0.5 rounded-full bg-muted p-1">
        {SCOPES.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={scope === key}
            onClick={() => setScope(key)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
              scope === key && "bg-background text-foreground shadow-sm",
            )}
          >
            {t(`campaign.scope.${key}`)}
          </button>
        ))}
      </div>
      {scope === "country" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <CountrySelect value={country} onChange={setCountry} />
          <p className="self-end text-xs text-muted-foreground md:pb-2">
            {t("campaign.countryHint")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <LeadLocationField picker={picker} />
          <Field>
            <FieldLabel htmlFor="campaign-radius">
              {t("form.radius")}
            </FieldLabel>
            <Input
              id="campaign-radius"
              type="number"
              min={1}
              max={100}
              value={radiusKm}
              onChange={(event) =>
                setRadiusKm(
                  Math.min(100, Math.max(1, Number(event.target.value) || 1)),
                )
              }
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function CountrySelect({
  value,
  onChange,
}: {
  value: LeadAreaCountry;
  onChange: (value: LeadAreaCountry) => void;
}) {
  const { t } = useTranslation("leads");
  return (
    <OptionSelect
      id="campaign-country"
      label={t("campaign.country")}
      value={value}
      options={LEAD_AREA_COUNTRIES}
      optionLabel={(code) => t(`campaign.countries.${code}`)}
      onChange={onChange}
    />
  );
}
