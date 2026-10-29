import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { Field, FieldLabel } from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import type { listAdDrafts } from "@/serverFunctions/ads";

export type AdDraftView = Awaited<ReturnType<typeof listAdDrafts>>[number];

export function cleanList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

export function ListField({
  label,
  values,
  onChange,
  multiline,
  max,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  multiline?: boolean;
  max: number;
}) {
  const { t } = useTranslation("ads");
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex gap-2">
            {multiline ? (
              <Textarea
                rows={3}
                aria-label={`${label} ${index + 1}`}
                value={value}
                onChange={(event) =>
                  onChange(
                    values.map((item, i) =>
                      i === index ? event.target.value : item,
                    ),
                  )
                }
              />
            ) : (
              <Input
                aria-label={`${label} ${index + 1}`}
                value={value}
                onChange={(event) =>
                  onChange(
                    values.map((item, i) =>
                      i === index ? event.target.value : item,
                    ),
                  )
                }
              />
            )}
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="×"
              onClick={() => onChange(values.filter((_, i) => i !== index))}
            >
              <X className="size-3" />
            </Button>
          </div>
        ))}
        {values.length < max ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange([...values, ""])}
          >
            <Plus className="size-4" />
            {t("editor.addItem")}
          </Button>
        ) : null}
      </div>
    </Field>
  );
}

export function AdContextBox({ draft }: { draft: AdDraftView | null }) {
  const { t } = useTranslation("ads");
  return draft &&
    (draft.inspiration ||
      draft.sourceUrl ||
      draft.targetKeyword ||
      draft.contextNotes) ? (
    <div className="rounded-md border p-3 text-sm">
      <p className="mb-1 font-medium">{t("editor.context")}</p>
      {draft.targetKeyword ? <p>Keyword: {draft.targetKeyword}</p> : null}
      {draft.sourceUrl ? (
        <p className="break-all">
          {draft.sourceTitle ?? ""} {draft.sourceUrl}
        </p>
      ) : null}
      {draft.inspiration ? (
        <p>
          {t("editor.inspiration")}: {draft.inspiration}
        </p>
      ) : null}
      {draft.contextNotes ? (
        <p className="text-muted-foreground">{draft.contextNotes}</p>
      ) : null}
    </div>
  ) : null;
}

export function AdErrorNote({ draft }: { draft: AdDraftView | null }) {
  const { t } = useTranslation("ads");
  return draft?.errorMessage ? (
    <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
      <span className="font-medium">{t("editor.error")}: </span>
      {draft.errorMessage}
    </p>
  ) : null;
}
