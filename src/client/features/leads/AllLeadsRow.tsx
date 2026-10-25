import type { ReactNode } from "react";
import { Instagram, MessageCircle, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SafeExternalLink } from "@/client/components/SafeExternalLink";
import { Checkbox } from "@/client/components/ui/checkbox";
import { FirstLineEditor } from "@/client/features/leads/FirstLineEditor";
import { LeadNote } from "@/client/features/leads/LeadNote";
import {
  OutreachStatusMenu,
  PriorContactBadge,
  ScoreBadge,
} from "@/client/features/leads/leadBadges";
import { LeadFindings } from "@/client/features/leads/LeadFindings";
import type { ProjectLeadRow } from "@/client/features/leads/leadQueries";
import { formatRelativeTime } from "@/client/lib/relative-time";
import type { LeadOutreachStatus } from "@/shared/leadFindings";
import { safeHttpUrl } from "@/shared/safe-url";

export function AllLeadsRow({
  projectId,
  lead,
  selected,
  onSelect,
  onStatus,
  statusPending,
  mail,
}: {
  projectId: string;
  lead: ProjectLeadRow;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onStatus: (status: LeadOutreachStatus) => void;
  statusPending: boolean;
  mail: ReactNode;
}) {
  const { t } = useTranslation("leads");
  return (
    <tr
      className="group border-t border-border/60 transition-colors hover:bg-muted/30 data-[selected=true]:bg-muted/40"
      data-selected={selected}
    >
      <td className="w-10 py-2.5 pr-0 pl-4 align-top">
        <Checkbox
          checked={selected}
          onCheckedChange={(value) => onSelect(value === true)}
          aria-label={t("all.selectLead", { name: lead.name })}
        />
      </td>
      <td className="max-w-96 py-2.5 pr-4 pl-3 align-top">
        <p className="truncate font-medium leading-snug" title={lead.name}>
          {lead.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {lead.website ? (
            <SafeExternalLink
              url={lead.website}
              label={lead.domain ?? lead.website}
              className="hover:text-foreground hover:underline"
            />
          ) : (
            t("findings.no_website")
          )}
          <span className="mx-1.5 opacity-40">·</span>
          <span title={lead.searchLabel}>{lead.searchLabel}</span>
        </p>
        {lead.priorContact ? (
          <div className="mt-1">
            <PriorContactBadge prior={lead.priorContact} />
          </div>
        ) : null}
        <FirstLineEditor
          projectId={projectId}
          leadId={lead.id}
          firstLine={lead.firstLine}
        />
        <LeadNote projectId={projectId} lead={lead} />
      </td>
      <td className="py-2.5 pr-4 align-top">
        <ScoreBadge score={lead.opportunityScore} />
      </td>
      <td className="w-72 min-w-56 py-2.5 pr-4 align-top">
        <LeadFindings lead={lead} max={2} />
      </td>
      <td className="py-2.5 pr-4 align-top">
        {lead.primaryEmail ? (
          <p className="max-w-56 truncate font-mono text-xs select-all">
            {lead.primaryEmail}
          </p>
        ) : (
          <FallbackContact lead={lead} />
        )}
      </td>
      <td className="py-2.5 pr-4 text-right align-top">
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          {mail}
          <OutreachStatusMenu
            status={lead.outreachStatus}
            onChange={onStatus}
            disabled={statusPending}
          />
        </div>
        {lead.contactedAt ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("all.contactedOn", {
              when: formatRelativeTime(lead.contactedAt),
            })}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

function FallbackContact({ lead }: { lead: ProjectLeadRow }) {
  const instagram = lead.instagramUrl ? safeHttpUrl(lead.instagramUrl) : null;
  const whatsapp = lead.whatsappUrl ? safeHttpUrl(lead.whatsappUrl) : null;
  if (!lead.phone && !instagram && !whatsapp) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      {lead.phone ? (
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Phone className="size-3" />
          {lead.phone}
        </span>
      ) : null}
      {instagram ? (
        <a
          href={instagram}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-foreground"
        >
          <Instagram className="size-3" />
          Instagram
        </a>
      ) : null}
      {whatsapp ? (
        <a
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-foreground"
        >
          <MessageCircle className="size-3" />
          WhatsApp
        </a>
      ) : null}
    </div>
  );
}
