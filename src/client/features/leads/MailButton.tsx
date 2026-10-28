import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Button } from "@/client/components/ui/button";
import { formatRelativeTime } from "@/client/lib/relative-time";
import { reportUrlFor } from "@/client/features/leads/ReportButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import {
  leadFindingPhrasesOptions,
  leadTemplatesOptions,
  type LeadTemplate,
  type ProjectLeadRow,
} from "@/client/features/leads/leadQueries";
import {
  composeUrl,
  leadTemplateValues,
  renderTemplate,
  SAMPLE_TEMPLATES,
  type LeadMailClient,
} from "@/shared/leadEmail";
import type { LeadMailStep } from "@/shared/leadFollowUp";

type MailTemplate = Omit<LeadTemplate, "id"> & { id?: string };

export function MailButton({
  projectId,
  lead,
  mailClient,
  onOpened,
  step = 1,
  label,
}: {
  projectId: string;
  lead: ProjectLeadRow;
  mailClient: LeadMailClient;
  onOpened: () => void;
  step?: LeadMailStep;
  label?: string;
}) {
  const { t } = useTranslation("leads");
  const [confirming, setConfirming] = useState<MailTemplate | null>(null);
  const templates = useQuery(leadTemplatesOptions(projectId)).data ?? [];
  const phrases = useQuery(leadFindingPhrasesOptions(projectId)).data ?? [];
  const email = lead.primaryEmail ?? "";
  const prior = step === 1 ? lead.priorContact : null;

  const forStep = templates.filter((template) => template.step === step);
  const saved: MailTemplate[] = forStep.length
    ? forStep
    : SAMPLE_TEMPLATES.filter((template) => template.step === step);
  const groups = [
    saved.filter((template) => template.language === lead.language),
    saved.filter((template) => template.language !== lead.language),
  ].filter((group) => group.length > 0);
  const choices = groups.flat();

  const send = (template: MailTemplate) => {
    const values = leadTemplateValues(
      lead,
      template.language,
      reportUrlFor(lead.reportToken),
      Object.fromEntries(
        phrases
          .filter((phrase) => phrase.language === template.language)
          .map((phrase) => [phrase.code, phrase.text]),
      ),
    );
    const url = composeUrl(mailClient, {
      to: email,
      subject: renderTemplate(template.subject, values),
      body: renderTemplate(template.body, values),
    });
    if (mailClient === "gmail") {
      const width = Math.min(760, window.screen.availWidth - 40);
      const height = Math.min(860, window.screen.availHeight - 60);
      const left = window.screenX + window.outerWidth - width - 20;
      window.open(
        url,
        "mericseo-mail",
        `popup,width=${width},height=${height},left=${Math.max(0, left)},top=${window.screenY + 40}`,
      );
    } else {
      window.location.href = url;
    }
    onOpened();
  };
  const open = (template: MailTemplate) => {
    if (prior) setConfirming(template);
    else send(template);
  };
  const confirmDialog = confirming ? (
    <ConfirmDialog
      title={t("prior.confirmTitle")}
      confirmLabel={t("prior.send")}
      onConfirm={() => {
        setConfirming(null);
        send(confirming);
      }}
      onClose={() => setConfirming(null)}
    >
      {prior?.suppressed
        ? t("prior.confirmSuppressed")
        : t("prior.confirmBody", {
            when: prior?.contactedAt
              ? formatRelativeTime(prior.contactedAt)
              : "",
          })}
    </ConfirmDialog>
  ) : null;

  if (choices.length === 1) {
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={() => open(choices[0])}
        >
          <Mail data-icon="inline-start" />
          {label ?? t("templates.send")}
        </Button>
        {confirmDialog}
      </>
    );
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="sm" variant="outline" className="rounded-full" />
          }
        >
          <Mail data-icon="inline-start" />
          {label ?? t("templates.send")}
          <ChevronDown data-icon="inline-end" className="opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {groups.map((group, index) => (
            <DropdownMenuGroup key={group[0].language}>
              {index > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuLabel>
                {t("templates.language")}: {group[0].language.toUpperCase()}
              </DropdownMenuLabel>
              {group.map((template) => (
                <DropdownMenuItem
                  key={template.id ?? template.name}
                  onClick={() => open(template)}
                  className="flex-col items-start gap-0.5"
                >
                  <span>{template.name}</span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">
                    {template.subject}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  );
}
