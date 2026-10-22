import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/client/components/ui/button";
import { Field, FieldLabel } from "@/client/components/ui/field";
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
  prQueryKey,
  prTemplatesOptions,
} from "@/client/features/digital-pr/prQueries";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { deletePrTemplate, savePrTemplate } from "@/serverFunctions/digitalPr";
import {
  PR_LANGUAGES,
  PR_SAMPLE_TEMPLATES,
  PR_TEMPLATE_VARIABLES,
  type PrLanguage,
} from "@/shared/digitalPr";
import type { LeadMailClient } from "@/shared/leadEmail";

type Draft = {
  id?: string;
  name: string;
  language: PrLanguage;
  subject: string;
  body: string;
};

const EMPTY_DRAFT: Draft = { name: "", language: "tr", subject: "", body: "" };

export function PrTemplatesSheet({
  projectId,
  open,
  onOpenChange,
  mailClient,
  onMailClientChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mailClient: LeadMailClient;
  onMailClientChange: (client: LeadMailClient) => void;
}) {
  const { t } = useTranslation("digitalPr");
  const queryClient = useQueryClient();
  const templatesQuery = useQuery(prTemplatesOptions(projectId));
  const [draft, setDraft] = useState<Draft | null>(null);
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: prQueryKey(projectId) });

  const saveMutation = useMutation({
    mutationFn: (input: Draft) =>
      savePrTemplate({
        data: {
          projectId,
          templateId: input.id,
          name: input.name,
          language: input.language,
          subject: input.subject,
          body: input.body,
        },
      }),
    onSuccess: async () => {
      setDraft(null);
      toast.success(t("templates.saved"));
      await invalidate();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });
  const deleteMutation = useMutation({
    mutationFn: (templateId: string) =>
      deletePrTemplate({ data: { projectId, templateId } }),
    onSuccess: async () => {
      setDraft(null);
      await invalidate();
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });
  const samplesMutation = useMutation({
    mutationFn: async () => {
      for (const sample of PR_SAMPLE_TEMPLATES) {
        await savePrTemplate({ data: { projectId, ...sample } });
      }
    },
    onSuccess: invalidate,
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });

  const templates = templatesQuery.data ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t("templates.title")}</SheetTitle>
          <SheetDescription>{t("templates.description")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <OptionSelect
            id="pr-mail-client"
            label={t("templates.openWith")}
            value={mailClient}
            options={["gmail", "mailto"] as const}
            optionLabel={(value) => t(`templates.clients.${value}`)}
            onChange={onMailClientChange}
          />
          {draft ? (
            <TemplateEditor
              draft={draft}
              onChange={setDraft}
              onCancel={() => setDraft(null)}
              onSave={() => saveMutation.mutate(draft)}
              saving={saveMutation.isPending}
            />
          ) : (
            <div className="space-y-2">
              {templates.length === 0 ? (
                <div className="space-y-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  <p>{t("templates.empty")}</p>
                  <Button
                    size="sm"
                    pending={samplesMutation.isPending}
                    onClick={() => samplesMutation.mutate()}
                  >
                    {t("templates.addSamples")}
                  </Button>
                </div>
              ) : (
                templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center gap-3 rounded-xl border border-border p-3"
                  >
                    <Mail className="size-4 shrink-0 text-muted-foreground" />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() =>
                        setDraft({
                          id: template.id,
                          name: template.name,
                          language: template.language,
                          subject: template.subject,
                          body: template.body,
                        })
                      }
                    >
                      <p className="truncate text-sm font-medium">
                        {template.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {template.language.toUpperCase()} · {template.subject}
                      </p>
                    </button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t("templates.delete")}
                      onClick={() => deleteMutation.mutate(template.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDraft(EMPTY_DRAFT)}
              >
                <Plus data-icon="inline-start" />
                {t("templates.new")}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TemplateEditor({
  draft,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation("digitalPr");
  const valid =
    draft.name.trim() && draft.subject.trim() && draft.body.trim().length > 0;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <Field>
          <FieldLabel htmlFor="pr-template-name">
            {t("templates.name")}
          </FieldLabel>
          <Input
            id="pr-template-name"
            value={draft.name}
            onChange={(event) =>
              onChange({ ...draft, name: event.target.value })
            }
          />
        </Field>
        <OptionSelect
          id="pr-template-language"
          label={t("templates.language")}
          value={draft.language}
          options={PR_LANGUAGES}
          optionLabel={(value) => value.toUpperCase()}
          onChange={(language) => onChange({ ...draft, language })}
        />
      </div>
      <Field>
        <FieldLabel htmlFor="pr-template-subject">
          {t("templates.subject")}
        </FieldLabel>
        <Input
          id="pr-template-subject"
          value={draft.subject}
          onChange={(event) =>
            onChange({ ...draft, subject: event.target.value })
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="pr-template-body">
          {t("templates.body")}
        </FieldLabel>
        <Textarea
          id="pr-template-body"
          rows={12}
          value={draft.body}
          onChange={(event) => onChange({ ...draft, body: event.target.value })}
          className="font-mono text-xs"
        />
      </Field>
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">
          {t("templates.variables")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PR_TEMPLATE_VARIABLES.map((variable) => (
            <button
              key={variable}
              type="button"
              title={t(`templates.variableHints.${variable}`)}
              className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] hover:bg-muted/70"
              onClick={() =>
                onChange({ ...draft, body: `${draft.body}{{${variable}}}` })
              }
            >
              {`{{${variable}}}`}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button disabled={!valid} pending={saving} onClick={onSave}>
          {t("templates.save")}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}
