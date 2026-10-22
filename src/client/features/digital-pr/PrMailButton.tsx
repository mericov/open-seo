import { ChevronDown, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/client/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import {
  type PrTarget,
  type PrTemplate,
} from "@/client/features/digital-pr/prQueries";
import { PR_SAMPLE_TEMPLATES, prTemplateValues } from "@/shared/digitalPr";
import {
  composeUrl,
  renderTemplate,
  type LeadMailClient,
} from "@/shared/leadEmail";
type MailTemplate = Omit<
  PrTemplate,
  "id" | "projectId" | "createdAt" | "updatedAt"
> & {
  id?: string;
};

export function PrMailButton({
  target,
  templates,
  project,
  mailClient,
  onOpened,
}: {
  target: PrTarget;
  templates: PrTemplate[];
  project: { name: string; domain: string | null };
  mailClient: LeadMailClient;
  onOpened: () => void;
}) {
  const { t } = useTranslation("digitalPr");
  const email = target.email;
  if (!email) return null;
  const saved: MailTemplate[] = templates.length
    ? templates
    : PR_SAMPLE_TEMPLATES;
  const choices = [
    ...saved.filter((template) => template.language === target.language),
    ...saved.filter((template) => template.language !== target.language),
  ];

  const open = (template: MailTemplate) => {
    const values = prTemplateValues(
      {
        contactName: target.contactName,
        outletName: target.outletName,
        outletDomain: target.outletDomain,
        articleTitle: target.latestArticle?.title ?? null,
        pitch: target.pitch,
      },
      project,
      template.language,
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

  if (choices.length === 1 && choices[0]) {
    const only = choices[0];
    return (
      <Button
        size="sm"
        variant="outline"
        className="rounded-full"
        onClick={() => open(only)}
      >
        <Mail data-icon="inline-start" />
        {t("outreach.write")}
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button size="sm" variant="outline" className="rounded-full" />}
      >
        <Mail data-icon="inline-start" />
        {t("outreach.write")}
        <ChevronDown data-icon="inline-end" className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("outreach.pickTemplate")}</DropdownMenuLabel>
          {choices.map((template) => (
            <DropdownMenuItem
              key={template.id ?? template.name}
              onClick={() => open(template)}
            >
              <span className="truncate">{template.name}</span>
              <span className="ml-auto text-[11px] uppercase text-muted-foreground">
                {template.language}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
