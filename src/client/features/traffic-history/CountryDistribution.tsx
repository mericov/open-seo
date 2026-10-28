import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "cn";
import { Button } from "@/client/components/ui/button";
import { getCurrentLocale } from "@/i18n/config";
import { localizeCountryOptions } from "@/i18n/format";
import { LABS_LOCATION_OPTIONS } from "@/shared/keyword-locations";
import type { TrafficHistoryData } from "./trafficHistoryQueries";
import { formatCompact } from "./trafficHistoryUtils";

const VISIBLE_COUNTRIES = 8;

type Props = {
  countries: TrafficHistoryData["countries"];
  activeLocationCode: number;
  onSelect: (locationCode: number) => void;
};

export function useCountryNames() {
  const locale = getCurrentLocale();
  return useMemo(
    () =>
      new Map(
        localizeCountryOptions(LABS_LOCATION_OPTIONS, locale).map((option) => [
          option.code,
          option.label,
        ]),
      ),
    [locale],
  );
}

export function CountryDistribution({
  countries,
  activeLocationCode,
  onSelect,
}: Props) {
  const { t } = useTranslation("trafficHistory");
  const names = useCountryNames();
  const [showAll, setShowAll] = useState(false);

  const known = countries.filter((country) => names.has(country.locationCode));
  const total = known.reduce((sum, country) => sum + country.organicTraffic, 0);
  const visible = showAll ? known : known.slice(0, VISIBLE_COUNTRIES);

  return (
    <section className="rounded-lg border border-border p-3">
      <h3 className="text-sm font-semibold">{t("countries.title")}</h3>
      {known.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {t("countries.empty")}
        </p>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-x-3 px-2 text-xs text-muted-foreground">
            <span>{t("countries.country")}</span>
            <span className="text-right">{t("countries.traffic")}</span>
            <span className="w-14 text-right">{t("countries.keywords")}</span>
          </div>
          <ul className="mt-1 space-y-0.5">
            {visible.map((country) => {
              const share =
                total > 0 ? (country.organicTraffic / total) * 100 : 0;
              const active = country.locationCode === activeLocationCode;
              return (
                <li key={country.locationCode}>
                  <button
                    type="button"
                    onClick={() => onSelect(country.locationCode)}
                    aria-pressed={active}
                    className={cn(
                      "grid w-full grid-cols-[1fr_auto_auto] items-center gap-x-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                      active && "bg-muted font-medium",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">
                        {names.get(country.locationCode)}
                      </span>
                      <span className="mt-1 block h-1 rounded-full bg-muted">
                        <span
                          className="block h-1 rounded-full bg-primary"
                          style={{ width: `${Math.max(share, 1)}%` }}
                        />
                      </span>
                    </span>
                    <span className="text-right tabular-nums">
                      {formatCompact(country.organicTraffic)}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {share.toFixed(0)}%
                      </span>
                    </span>
                    <span className="w-14 text-right tabular-nums">
                      {formatCompact(country.organicKeywords)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {known.length > VISIBLE_COUNTRIES ? (
            <Button
              variant="link"
              size="sm"
              className="mt-1 px-2"
              onClick={() => setShowAll((value) => !value)}
            >
              {showAll
                ? t("countries.showLess")
                : t("countries.showAll", { count: known.length })}
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}
