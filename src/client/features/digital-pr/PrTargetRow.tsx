import { type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SafeExternalLink } from "@/client/components/SafeExternalLink";
import { Badge } from "@/client/components/ui/badge";
import { Checkbox } from "@/client/components/ui/checkbox";
import {
  PitchEditor,
  PrStatusMenu,
  TargetNote,
} from "@/client/features/digital-pr/PrTargetParts";
import { type PrTarget } from "@/client/features/digital-pr/prQueries";
import { formatRelativeTime } from "@/client/lib/relative-time";
import { type PrTargetStatus } from "@/shared/digitalPr";
import { safeHttpUrl } from "@/shared/safe-url";
export function PrTargetRow({
  projectId,
  target,
  selected,
  onSelect,
  mail,
  onStatus,
  statusPending,
}: {
  projectId: string;
  target: PrTarget;
  selected: boolean;
  onSelect: (value: boolean) => void;
  mail: ReactNode;
  onStatus: (status: PrTargetStatus) => void;
  statusPending: boolean;
}) {
  const { t } = useTranslation("digitalPr");
  const outletLabel = target.outletName ?? target.outletDomain;
  const articleUrl = target.latestArticle
    ? safeHttpUrl(target.latestArticle.url)
    : null;
  return (
    <tr
      className="group border-t border-border/60 transition-colors hover:bg-muted/30 data-[selected=true]:bg-muted/40"
      data-selected={selected}
    >
      <td className="w-10 py-3.5 pr-0 pl-4 align-top">
        <Checkbox
          checked={selected}
          onCheckedChange={(value) => onSelect(value)}
          aria-label={t("common.selectRow", {
            name: target.contactName ?? outletLabel,
          })}
        />
      </td>
      <td className="max-w-[28rem] py-3.5 pr-4 pl-3 align-top">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">
            {target.contactName ?? outletLabel}
          </span>
          {target.contactRole ? (
            <Badge variant="outline" size="sm">
              {t(`roles.${target.contactRole}`)}
            </Badge>
          ) : null}
          <Badge variant="secondary" size="sm">
            {t(`sources.${target.source}`)}
          </Badge>
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          <SafeExternalLink
            url={`https://${target.outletDomain}/`}
            label={target.contactName ? outletLabel : target.outletDomain}
            className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
          />
          {target.jobTitle ? (
            <>
              <span className="mx-1.5 opacity-40">·</span>
              {target.jobTitle}
            </>
          ) : null}
        </p>
        {target.latestArticle ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {t("outreach.latest")}{" "}
            {articleUrl ? (
              <a
                href={articleUrl}
                target="_blank"
                rel="noreferrer"
                className="text-foreground/80 hover:underline"
              >
                {target.latestArticle.title ?? target.latestArticle.url}
              </a>
            ) : (
              target.latestArticle.title
            )}
          </p>
        ) : null}
        <PitchEditor projectId={projectId} target={target} />
        <TargetNote projectId={projectId} target={target} />
      </td>
      <td className="py-3.5 pr-4 align-top">
        {target.email ? (
          <p className="max-w-56 truncate font-mono text-xs select-all">
            {target.email}
          </p>
        ) : (
          <span className="text-xs text-muted-foreground">
            {target.enrichStatus === "pending"
              ? t("media.readingSite")
              : t("outreach.noEmail")}
          </span>
        )}
        {target.otherEmails.length > 0 ? (
          <p
            className="mt-0.5 text-[11px] text-muted-foreground"
            title={target.otherEmails.join(", ")}
          >
            {t("outreach.otherEmails", { count: target.otherEmails.length })}
          </p>
        ) : null}
        {target.contactedElsewhere ? (
          <p className="mt-1 inline-flex max-w-56 items-start gap-1 text-[11px] text-warning-foreground dark:text-warning">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
            <span>
              {t(
                target.contactedElsewhere.sameContact
                  ? "outreach.contactedElsewhereContact"
                  : "outreach.contactedElsewhereOutlet",
                {
                  project: target.contactedElsewhere.projectName,
                  when: target.contactedElsewhere.contactedAt
                    ? formatRelativeTime(target.contactedElsewhere.contactedAt)
                    : "",
                },
              )}
            </span>
          </p>
        ) : null}
      </td>
      <td className="py-3.5 pr-4 text-right align-top">
        <div className="flex items-center justify-end gap-2">
          {mail}
          <PrStatusMenu
            status={target.status}
            onChange={onStatus}
            disabled={statusPending}
          />
        </div>
        {target.contactedAt ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("outreach.contactedOn", {
              when: formatRelativeTime(target.contactedAt),
            })}
          </p>
        ) : null}
      </td>
    </tr>
  );
}
