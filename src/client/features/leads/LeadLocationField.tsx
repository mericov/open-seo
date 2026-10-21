import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/client/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { findLeadLocations } from "@/serverFunctions/leads";

type LeadPlace = Awaited<ReturnType<typeof findLeadLocations>>[number];

export function useLocationPicker(projectId: string) {
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState<LeadPlace | null>(null);
  const lookup = useMutation({
    mutationFn: (text: string) =>
      findLeadLocations({ data: { projectId, query: text } }),
  });

  const resolve = async (): Promise<LeadPlace | null> => {
    if (place) return place;
    const candidates = await lookup.mutateAsync(query.trim());
    if (candidates.length !== 1) return null;
    setPlace(candidates[0]);
    return candidates[0];
  };

  const changeQuery = (text: string) => {
    setQuery(text);
    setPlace(null);
    lookup.reset();
  };

  return { query, changeQuery, place, setPlace, lookup, resolve };
}

export function LeadLocationField({
  picker,
}: {
  picker: ReturnType<typeof useLocationPicker>;
}) {
  const { t } = useTranslation("leads");
  const { query, changeQuery, place, setPlace, lookup, resolve } = picker;
  const candidates = lookup.data ?? [];

  return (
    <Field>
      <FieldLabel htmlFor="lead-location">{t("form.location")}</FieldLabel>
      <div className="flex gap-2">
        <Input
          id="lead-location"
          autoComplete="off"
          placeholder={t("form.locationPlaceholder")}
          value={query}
          onChange={(event) => changeQuery(event.target.value)}
          required
        />
        <Button
          type="button"
          variant="outline"
          pending={lookup.isPending}
          disabled={query.trim().length < 2 || place != null}
          onClick={() => void resolve().catch(() => undefined)}
        >
          <MapPin className="size-4" />
          {t("form.findLocation")}
        </Button>
      </div>
      {place ? (
        <FieldDescription className="inline-flex items-center gap-1">
          <Check className="size-3 text-success" />
          {place.label}
        </FieldDescription>
      ) : lookup.isError ? (
        <p className="text-xs text-destructive">
          {getStandardErrorMessage(lookup.error)}
        </p>
      ) : lookup.isSuccess && candidates.length === 0 ? (
        <p className="text-xs text-destructive">{t("form.noLocations")}</p>
      ) : candidates.length > 1 ? (
        <div className="space-y-1.5">
          <FieldDescription>{t("form.pickLocation")}</FieldDescription>
          <div className="flex flex-col gap-1">
            {candidates.map((candidate) => (
              <button
                key={`${candidate.latitude},${candidate.longitude}`}
                type="button"
                className="rounded-md border border-border px-2 py-1.5 text-left text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => setPlace(candidate)}
              >
                {candidate.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <FieldDescription>{t("form.locationHint")}</FieldDescription>
      )}
    </Field>
  );
}
