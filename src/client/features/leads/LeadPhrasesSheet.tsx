import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import { Textarea } from "@/client/components/ui/textarea";
import { OptionSelect } from "@/client/features/leads/OptionSelect";
import {
  leadFindingPhrasesOptions,
  leadsQueryKey,
} from "@/client/features/leads/leadQueries";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { saveLeadFindingPhrase } from "@/serverFunctions/leads";
import {
  LEAD_EMAIL_LANGUAGES,
  type LeadEmailLanguage,
} from "@/shared/leadEmail";
import { DEFAULT_FINDING_PHRASES } from "@/shared/leadFindingPhrases";
import {
  LEAD_FINDING_CODES,
  type LeadFindingCode,
} from "@/shared/leadFindings";

export function LeadPhrasesButton({ projectId }: { projectId: string }) {
  const { t } = useTranslation("leads");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <PenLine data-icon="inline-start" />
        {t("phrases.title")}
      </Button>
      <LeadPhrasesSheet
        projectId={projectId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

function LeadPhrasesSheet({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("leads");
  const queryClient = useQueryClient();
  const phrasesQuery = useQuery(leadFindingPhrasesOptions(projectId));
  const [language, setLanguage] = useState<LeadEmailLanguage>("tr");
  const [search, setSearch] = useState("");

  const saveMutation = useMutation({
    mutationFn: (input: { code: LeadFindingCode; text: string }) =>
      saveLeadFindingPhrase({ data: { projectId, language, ...input } }),
    onSuccess: async () => {
      toast.success(t("phrases.saved"));
      await queryClient.invalidateQueries({
        queryKey: leadsQueryKey(projectId),
      });
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const custom = new Map(
    (phrasesQuery.data ?? [])
      .filter((phrase) => phrase.language === language)
      .map((phrase) => [phrase.code, phrase.text]),
  );
  const query = search.trim().toLocaleLowerCase(language);
  const codes = LEAD_FINDING_CODES.filter((code) =>
    query
      ? [
          t(`findings.${code}`),
          custom.get(code) ?? DEFAULT_FINDING_PHRASES[language][code],
        ].some((text) => text.toLocaleLowerCase(language).includes(query))
      : true,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t("phrases.title")}</SheetTitle>
          <SheetDescription>{t("phrases.description")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <div className="grid gap-3 sm:grid-cols-[8rem_1fr] sm:items-end">
            <OptionSelect
              id="phrase-language"
              label={t("templates.language")}
              value={language}
              options={LEAD_EMAIL_LANGUAGES}
              optionLabel={(value) => value.toUpperCase()}
              onChange={setLanguage}
            />
            <Input
              value={search}
              placeholder={t("phrases.search")}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <ul className="space-y-3">
            {codes.map((code) => (
              <PhraseRow
                key={`${language}-${code}-${custom.get(code) ?? ""}`}
                label={t(`findings.${code}`)}
                defaultText={DEFAULT_FINDING_PHRASES[language][code]}
                customText={custom.get(code)}
                saving={saveMutation.isPending}
                onSave={(text) => saveMutation.mutate({ code, text })}
              />
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PhraseRow({
  label,
  defaultText,
  customText,
  saving,
  onSave,
}: {
  label: string;
  defaultText: string;
  customText: string | undefined;
  saving: boolean;
  onSave: (text: string) => void;
}) {
  const { t } = useTranslation("leads");
  const saved = customText ?? defaultText;
  const [text, setText] = useState(saved);
  const changed = text.trim() !== saved;

  return (
    <li className="space-y-2 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        {customText !== undefined ? (
          <span className="text-xs text-muted-foreground">
            {t("phrases.edited")}
          </span>
        ) : null}
      </div>
      <Textarea
        rows={2}
        maxLength={300}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="text-sm"
      />
      {changed || customText !== undefined ? (
        <div className="flex gap-2">
          {changed ? (
            <Button
              size="sm"
              disabled={!text.trim() || saving}
              onClick={() =>
                onSave(text.trim() === defaultText ? "" : text.trim())
              }
            >
              {t("templates.save")}
            </Button>
          ) : null}
          {customText !== undefined ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => onSave("")}
            >
              {t("phrases.reset")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
