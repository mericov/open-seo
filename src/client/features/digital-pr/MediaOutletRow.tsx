import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  EyeOff,
  ListPlus,
  Mail,
  Pencil,
  UserPlus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { SafeExternalLink } from "@/client/components/SafeExternalLink";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { formatCompact } from "@/client/features/digital-pr/PrControls";
import type {
  MediaContact,
  MediaOutlet,
} from "@/client/features/digital-pr/prQueries";
import { formatRelativeTime } from "@/client/lib/relative-time";
import { safeHttpUrl } from "@/shared/safe-url";
import { cn } from "cn";

export function MediaOutletRow({
  outlet,
  locale,
  selected,
  onSelect,
  onAddOutlet,
  onAddContact,
  onEditOutlet,
  onEditContact,
  onNewContact,
  onHideContact,
  busy,
}: {
  outlet: MediaOutlet;
  locale: string;
  selected: boolean;
  onSelect: (value: boolean) => void;
  onAddOutlet: () => void;
  onAddContact: (contact: MediaContact) => void;
  onEditOutlet: () => void;
  onEditContact: (contact: MediaContact) => void;
  onNewContact: () => void;
  onHideContact: (contact: MediaContact) => void;
  busy: boolean;
}) {
  const { t } = useTranslation("digitalPr");
  const [open, setOpen] = useState(false);
  const emails = outlet.contacts.filter((contact) => contact.email);
  const people = outlet.contacts.filter((contact) => contact.name);

  return (
    <>
      <tr
        className="group border-t border-border/60 transition-colors hover:bg-muted/30 data-[selected=true]:bg-muted/40"
        data-selected={selected}
      >
        <td className="w-10 py-3 pr-0 pl-4 align-top">
          <Checkbox
            checked={selected}
            onCheckedChange={(value) => onSelect(value)}
            aria-label={t("common.selectRow", { name: outlet.domain })}
          />
        </td>
        <td className="max-w-96 py-3 pr-4 pl-1 align-top">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="flex w-full items-start gap-1.5 text-left"
          >
            {open ? (
              <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {outlet.name ?? outlet.domain}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {outlet.domain}
                <span className="mx-1.5 opacity-40">·</span>
                {t(`types.${outlet.type}`)}
                <span className="mx-1.5 opacity-40">·</span>
                {t(`markets.${outlet.market}`)}
              </span>
            </span>
          </button>
          {outlet.topics.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1 pl-5.5">
              {outlet.topics.slice(0, 4).map((topic) => (
                <span
                  key={topic.id}
                  className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground"
                >
                  {topic.keyword}
                </span>
              ))}
            </div>
          ) : null}
          {outlet.notes ? (
            <p className="mt-1.5 line-clamp-2 pl-5.5 text-xs text-foreground/70">
              {outlet.notes}
            </p>
          ) : null}
        </td>
        <td className="py-3 pr-4 align-top tabular-nums">
          {formatCompact(outlet.organicTraffic, locale)}
        </td>
        <td className="py-3 pr-4 align-top">
          {outlet.enrichStatus === "pending" ? (
            <Badge variant="warning">{t("media.readingSite")}</Badge>
          ) : emails.length > 0 ? (
            <div className="space-y-0.5">
              <p className="max-w-56 truncate font-mono text-xs select-all">
                {emails[0]?.email}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t("media.contactSummary", {
                  emails: emails.length,
                  people: people.length,
                })}
              </p>
            </div>
          ) : people.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("media.peopleOnly", { count: people.length })}
            </p>
          ) : (
            <span className="text-xs text-muted-foreground">
              {outlet.enrichStatus === "failed" ? t("media.readFailed") : "—"}
            </span>
          )}
        </td>
        <td className="py-3 pr-4 text-right align-top">
          <div className="flex items-center justify-end gap-1">
            {outlet.inList ? (
              <Badge variant="success">{t("common.inList")}</Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={busy}
                onClick={onAddOutlet}
              >
                <ListPlus data-icon="inline-start" />
                {t("common.addToList")}
              </Button>
            )}
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t("media.editOutlet")}
              onClick={onEditOutlet}
            >
              <Pencil />
            </Button>
          </div>
        </td>
      </tr>
      {open ? (
        <tr className="bg-muted/20">
          <td />
          <td colSpan={4} className="py-3 pr-4 pl-1">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {outlet.mastheadUrl ? (
                  <SafeExternalLink
                    url={outlet.mastheadUrl}
                    label={t("media.masthead")}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  />
                ) : null}
                {outlet.contactPageUrl ? (
                  <SafeExternalLink
                    url={outlet.contactPageUrl}
                    label={t("media.contactPage")}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  />
                ) : null}
                {outlet.lastSeenAt ? (
                  <span>
                    {t("media.lastSeen", {
                      when: formatRelativeTime(outlet.lastSeenAt),
                    })}
                  </span>
                ) : null}
              </div>
              {outlet.contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("media.noContacts")}
                </p>
              ) : (
                <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-background">
                  {outlet.contacts.map((contact) => (
                    <ContactLine
                      key={contact.id}
                      contact={contact}
                      busy={busy}
                      onAdd={() => onAddContact(contact)}
                      onEdit={() => onEditContact(contact)}
                      onHide={() => onHideContact(contact)}
                    />
                  ))}
                </ul>
              )}
              <Button size="sm" variant="ghost" onClick={onNewContact}>
                <UserPlus data-icon="inline-start" />
                {t("media.addContact")}
              </Button>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ContactLine({
  contact,
  busy,
  onAdd,
  onEdit,
  onHide,
}: {
  contact: MediaContact;
  busy: boolean;
  onAdd: () => void;
  onEdit: () => void;
  onHide: () => void;
}) {
  const { t } = useTranslation("digitalPr");
  return (
    <li className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-0.5">
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <span
            className={cn(
              "font-medium",
              !contact.name && "text-muted-foreground",
            )}
          >
            {contact.name ?? t("media.unnamed")}
          </span>
          <Badge variant="outline" size="sm">
            {t(`roles.${contact.role}`)}
          </Badge>
          {contact.jobTitle ? (
            <span className="text-xs text-muted-foreground">
              {contact.jobTitle}
            </span>
          ) : null}
        </p>
        {contact.email ? (
          <p className="inline-flex items-center gap-1 font-mono text-xs select-all">
            <Mail className="size-3 text-muted-foreground" />
            {contact.email}
          </p>
        ) : null}
        {contact.recentArticles.length > 0 ? (
          <ul className="space-y-0.5 pt-0.5">
            {contact.recentArticles.map((article) => {
              const url = safeHttpUrl(article.url);
              return (
                <li
                  key={article.url}
                  className="truncate text-xs text-muted-foreground"
                >
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-foreground hover:underline"
                    >
                      {article.title ?? article.url}
                    </a>
                  ) : (
                    (article.title ?? article.url)
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
        {contact.articleCount > 0 ? (
          <p className="text-[11px] text-muted-foreground">
            {t("media.articleCount", { count: contact.articleCount })}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {contact.inList ? (
          <Badge variant="success">{t("common.inList")}</Badge>
        ) : (
          <Button size="xs" variant="outline" disabled={busy} onClick={onAdd}>
            <ListPlus data-icon="inline-start" />
            {t("common.addToList")}
          </Button>
        )}
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={t("media.editContact")}
          onClick={onEdit}
        >
          <Pencil />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={t("common.hide")}
          onClick={onHide}
        >
          <EyeOff />
        </Button>
      </div>
    </li>
  );
}
