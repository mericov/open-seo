import { ChevronDown, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/client/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import type {
  LeadTemplate,
  ProjectLeadRow,
} from "@/client/features/leads/leadQueries";
import {
  composeUrl,
  leadTemplateValues,
  renderTemplate,
  SAMPLE_TEMPLATES,
  type LeadMailClient,
} from "@/shared/leadEmail";

type MailTemplate = Omit<LeadTemplate, "id"> & { id?: string };

export function MailButton({
  lead,
  templates,
  mailClient,
  onOpened,
}: {
  lead: ProjectLeadRow;
  templates: LeadTemplate[];
  mailClient: LeadMailClient;
  onOpened: () => void;
}) {
  const { t } = useTranslation("leads");
  const email = lead.primaryEmail;
  if (!email) return null;

  const saved: MailTemplate[] = templates.length ? templates : SAMPLE_TEMPLATES;
  const sameLanguage = saved.filter(
    (template) => template.language === lead.language,
  );
  const choices = sameLanguage.length ? sameLanguage : saved;

  const open = (template: MailTemplate) => {
    const values = leadTemplateValues(lead, template.language);
    const url = composeUrl(mailClient, {
      to: email,
      subject: renderTemplate(template.subject, values),
      body: renderTemplate(template.body, values),
    });
    if (mailClient === "gmail") {
      window.open(url, "_blank", "noopener");
    } else {
      window.location.href = url;
    }
    onOpened();
  };

  if (choices.length === 1) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="rounded-full"
        onClick={() => open(choices[0])}
      >
        <Mail data-icon="inline-start" />
        {t("templates.send")}
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button size="sm" variant="outline" className="rounded-full" />}
      >
        <Mail data-icon="inline-start" />
        {t("templates.send")}
        <ChevronDown data-icon="inline-end" className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {choices.map((template) => (
          <DropdownMenuItem
            key={template.id ?? template.name}
            onClick={() => open(template)}
          >
            {template.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
