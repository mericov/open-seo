import type { ReactNode } from "react";
import { Instagram, MessageCircle, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SafeExternalLink } from "@/client/components/SafeExternalLink";
import { Badge } from "@/client/components/ui/badge";
import { TableCell, TableRow } from "@/client/components/ui/table";
import type { LeadRow } from "@/client/features/leads/leadQueries";
import { formatRelativeTime } from "@/client/lib/relative-time";
import type { LeadReachability } from "@/shared/leads";
import { safeHttpUrl } from "@/shared/safe-url";

const REACHABILITY_VARIANT: Record<
  LeadReachability,
  "success" | "info" | "destructive" | "secondary" | "warning"
> = {
  ready: "success",
  social_only: "info",
  email_unreachable: "destructive",
  no_contact: "secondary",
  pending: "warning",
};

export function LeadTableRow({
  lead,
  isStore,
}: {
  lead: LeadRow;
  isStore: boolean;
}) {
  const { t } = useTranslation("leads");
  const primary = lead.emails.find(
    (email) => email.email === lead.primaryEmail,
  );
  const others = lead.emails.length - (primary ? 1 : 0);
  return (
    <TableRow>
      <TableCell className="min-w-56 align-top">
        <div className="space-y-1">
          <p className="font-medium leading-snug">{lead.name}</p>
          {lead.category ? (
            <p className="text-xs text-muted-foreground">{lead.category}</p>
          ) : null}
          <Badge
            variant={REACHABILITY_VARIANT[lead.reachability]}
            title={t(`reachabilityHint.${lead.reachability}`)}
          >
            {t(`reachability.${lead.reachability}`)}
          </Badge>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {lead.website ? (
              <SafeExternalLink
                url={lead.website}
                label={lead.domain ?? t("table.website")}
                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
              />
            ) : (
              <span className="text-muted-foreground">
                {t("table.noWebsite")}
              </span>
            )}
            {lead.enrichmentStatus === "failed" ? (
              <span
                className="text-muted-foreground"
                title={t("table.siteUnreadableHint")}
              >
                {t("table.siteUnreadable")}
              </span>
            ) : null}
            {lead.mapsUrl ? (
              <SafeExternalLink
                url={lead.mapsUrl}
                label={t("table.maps")}
                className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:underline"
              />
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell className="align-top">
        {primary ? (
          <div className="space-y-1">
            <p className="select-all font-mono text-xs">{primary.email}</p>
            <p className="text-xs text-muted-foreground">
              {t(`emailKind.${primary.kind}`)}
              {others > 0
                ? ` · ${t("table.otherEmails", { count: others })}`
                : ""}
            </p>
          </div>
        ) : lead.emails.length > 0 ? (
          <p className="font-mono text-xs text-muted-foreground line-through">
            {lead.emails[0]?.email}
          </p>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-1 text-xs">
          {lead.phone ? (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Phone className="size-3 text-muted-foreground" />
              {lead.phone}
            </span>
          ) : null}
          <ContactLink
            url={lead.instagramUrl}
            icon={<Instagram className="size-3" />}
            label="Instagram"
          />
          <ContactLink
            url={lead.whatsappUrl}
            icon={<MessageCircle className="size-3" />}
            label="WhatsApp"
          />
          <ContactLink url={lead.facebookUrl} label="Facebook" />
          <ContactLink url={lead.linkedinUrl} label="LinkedIn" />
        </div>
      </TableCell>
      <TableCell className="text-right align-top text-xs tabular-nums">
        {isStore ? (
          <StoreStats lead={lead} />
        ) : lead.rating != null ? (
          <div>
            <p>★ {lead.rating.toFixed(1)}</p>
            {lead.reviewsCount != null ? (
              <p className="text-muted-foreground">
                {t("table.reviews", { count: lead.reviewsCount })}
              </p>
            ) : null}
          </div>
        ) : (
          "—"
        )}
      </TableCell>
    </TableRow>
  );
}

function StoreStats({ lead }: { lead: LeadRow }) {
  const { t } = useTranslation("leads");
  if (lead.productCount == null) {
    return (
      <span className="text-muted-foreground">
        {lead.enrichmentStatus === "pending" ? "—" : t("table.notVerified")}
      </span>
    );
  }
  return (
    <div>
      <p>{t("table.products", { count: lead.productCount })}</p>
      {lead.lastProductAt ? (
        <p className="text-muted-foreground">
          {t("table.newestProduct", {
            when: formatRelativeTime(lead.lastProductAt),
          })}
        </p>
      ) : null}
      {lead.countryCode || lead.currency ? (
        <p className="text-muted-foreground">
          {[lead.countryCode, lead.currency].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function ContactLink({
  url,
  label,
  icon,
}: {
  url: string | null;
  label: string;
  icon?: ReactNode;
}) {
  const safe = url ? safeHttpUrl(url) : null;
  if (!safe) return null;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
    >
      {icon}
      {label}
    </a>
  );
}
